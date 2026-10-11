import "dotenv/config";

import express from "express";
import multer from "multer";
import ffmpegPath from "ffmpeg-static";
import { GoogleAuth } from "google-auth-library";
import { spawn } from "node:child_process";
import {
  mkdir,
  readFile,
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const PORT = Number(process.env.PORT || 3000);
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;

const LOCATION = "global";
const MODEL = "gemini-3.8-flash-tts";

const PUBLIC_DIR = path.join(__dirname, "public");
const GENERATED_DIR = path.join(PUBLIC_DIR, "generated");

if (!PROJECT_ID || PROJECT_ID === "YOUR_ACTUAL_PROJECT_ID") {
  throw new Error(
    "Set GOOGLE_CLOUD_PROJECT to your actual Google Cloud Project ID in .env"
  );
}

if (!ffmpegPath) {
  throw new Error(
    "FFmpeg was not found. Reinstall ffmpeg-static and try again."
  );
}

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);

  res.on("finish", () => {
    console.log(
      `[HTTP] ${req.method} ${req.url} -> ${res.statusCode}`
    );
  });

  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 2
  }
});

// ==========================================
// GOOGLE CLOUD AUTHENTICATION
// ==========================================

const auth = new GoogleAuth({
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform"
  ]
});

async function googleFetch(url, options = {}) {
  const client = await auth.getClient();
  const token = await client.getAccessToken();

  if (!token?.token) {
    throw new Error(
      "Google Cloud authentication failed. Run gcloud auth application-default login."
    );
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const raw = await response.text();

  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    console.error("Google API HTTP status:", response.status);

    console.error(
      "Google API full error:",
      JSON.stringify(data, null, 2)
    );

    const message =
      data?.error?.message ||
      data?.message ||
      `Google API request failed with HTTP ${response.status}`;

    throw new Error(message);
  }

  return data;
}

// ==========================================
// AUDIO CONVERSION
// Convert to mono, 24 kHz, 16-bit PCM WAV
// ==========================================

async function convertToRequiredWav(inputBuffer) {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "voice-replication-")
  );

  const inputPath = path.join(tempDir, "input.audio");
  const outputPath = path.join(tempDir, "output.wav");

  try {
    await writeFile(inputPath, inputBuffer);

    await new Promise((resolve, reject) => {
      const args = [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-i", inputPath,
        "-vn",
        "-ac", "1",
        "-ar", "24000",
        "-c:a", "pcm_s16le",
        "-f", "wav",
        outputPath
      ];

      const child = spawn(ffmpegPath, args, {
        stdio: ["ignore", "ignore", "pipe"]
      });

      const stderr = [];

      child.stderr.on("data", chunk => {
        stderr.push(chunk);
      });

      child.on("error", reject);

      child.on("close", code => {
        if (code !== 0) {
          reject(
            new Error(
              `Audio conversion failed: ${Buffer.concat(stderr).toString("utf8")}`
            )
          );
        } else {
          resolve();
        }
      });
    });

    const wav = await readFile(outputPath);

    if (
      wav.length < 44 ||
      wav.toString("ascii", 0, 4) !== "RIFF" ||
      wav.toString("ascii", 8, 12) !== "WAVE"
    ) {
      throw new Error(
        "FFmpeg did not produce a valid WAV file."
      );
    }

    console.log("WAV header check:", {
      declaredSize: wav.readUInt32LE(4),
      actualSize: wav.length - 8,
      sampleRate: wav.readUInt32LE(24),
      channels: wav.readUInt16LE(22),
      bitsPerSample: wav.readUInt16LE(34)
    });

    return wav;
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    });
  }
}

// ==========================================
// READ AND PREPARE AUDIO UPLOAD
// ==========================================

async function readAudioUpload(file, fieldName) {
  if (!file) {
    throw new Error(
      `Please upload the ${fieldName} recording.`
    );
  }

  const wav = await convertToRequiredWav(file.buffer);

  const sampleRate = wav.readUInt32LE(24);
  const channels = wav.readUInt16LE(22);
  const bitsPerSample = wav.readUInt16LE(34);

  console.log(`[${fieldName}] Audio details:`, {
    sampleRate,
    channels,
    bitsPerSample,
    bytes: wav.length
  });

  if (
    sampleRate !== 24000 ||
    channels !== 1 ||
    bitsPerSample !== 16
  ) {
    throw new Error(
      `${fieldName} audio must be mono, 24 kHz, 16-bit PCM WAV.`
    );
  }

  return {
    mimeType: "audio/wav",
    data: wav.toString("base64")
  };
}

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Voice Replication server is running",
    model: MODEL,
    location: LOCATION
  });
});

// ==========================================
// CREATE AND STORE A REPLICATED VOICE
// ==========================================

app.post(
  "/api/create-voice",
  upload.fields([
    {
      name: "referenceAudio",
      maxCount: 1
    },
    {
      name: "consentAudio",
      maxCount: 1
    }
  ]),
  async (req, res) => {
    try {
      const referenceFile =
        req.files?.referenceAudio?.[0];

      const consentFile =
        req.files?.consentAudio?.[0];

      const displayName = String(
        req.body.displayName || "My Replicated Voice"
      )
        .trim()
        .slice(0, 100);

      if (!referenceFile || !consentFile) {
        return res.status(400).json({
          success: false,
          error:
            "Upload both the reference recording and consent recording."
        });
      }

      const [sourceAudio, consentAudio] =
        await Promise.all([
          readAudioUpload(referenceFile, "reference"),
          readAudioUpload(consentFile, "consent")
        ]);

      const url =
        "https://aiplatform.googleapis.com/v1beta1/projects/" +
        `${encodeURIComponent(PROJECT_ID)}/locations/${LOCATION}/voices`;

      const result = await googleFetch(url, {
        method: "POST",
        body: JSON.stringify({
          store: true,
          voice: {
            type: "VOICE_TYPE_REPLICATED",
            displayName,
            replicated: {
              sourceAudio,
              consentAudio
            }
          }
        })
      });

      const voiceId = result.id;

      if (
        typeof voiceId !== "string" ||
        !voiceId.startsWith("voice_")
      ) {
        console.error(
          "Unexpected voice creation response:",
          result
        );

        throw new Error(
          "Google did not return a stored voice ID. Check the API response and project access."
        );
      }

      console.log("Voice created successfully:", voiceId);

      return res.json({
        success: true,
        voiceId,
        message: "Voice replication completed successfully."
      });
    } catch (error) {
      console.error("Create voice error:", error);

      return res.status(500).json({
        success: false,
        error: error.message || "Voice creation failed."
      });
    }
  }
);

// ==========================================
// GENERATE SPEECH USING A VOICE ID
// ==========================================

app.post("/api/generate-speech", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    const voiceId = String(req.body?.voiceId || "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "Enter the text you want the voice to speak."
      });
    }

    if (!/^voice_[A-Za-z0-9_-]+$/.test(voiceId)) {
      return res.status(400).json({
        success: false,
        error:
          "Enter a valid Voice ID beginning with voice_."
      });
    }

    if (text.length > 4000) {
      return res.status(400).json({
        success: false,
        error:
          "For this prototype, keep the text under 4,000 characters."
      });
    }

    const url =
      "https://aiplatform.googleapis.com/v1/projects/" +
      `${encodeURIComponent(PROJECT_ID)}/locations/${LOCATION}/publishers/google/models/` +
      `${MODEL}:generateContent`;

    const result = await googleFetch(url, {
      method: "POST",
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text,
                speechMetadata: {
                  style: "Natural, clear, warm and conversational"
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              voice: voiceId
            }
          }
        }
      })
    });

    const parts =
      result.candidates?.[0]?.content?.parts || [];

    const audioPart = parts.find(
      part => part.inlineData?.data
    );

    if (!audioPart) {
      console.error(
        "No audio returned by Google:",
        JSON.stringify(result)
      );

      throw new Error(
        "The model returned no audio. Check model access and the API response."
      );
    }

    const audioBuffer = Buffer.from(
      audioPart.inlineData.data,
      "base64"
    );

    // Unary generateContent is expected to return a WAV file.
    if (
      audioBuffer.length < 44 ||
      audioBuffer.toString("ascii", 0, 4) !== "RIFF" ||
      audioBuffer.toString("ascii", 8, 12) !== "WAVE"
    ) {
      console.error(
        "Audio response does not contain a WAV header.",
        {
          bytes: audioBuffer.length,
          mimeType: audioPart.inlineData.mimeType
        }
      );

      throw new Error(
        "Google returned audio that is not a WAV file. Check the response audio format before saving it."
      );
    }

    await mkdir(GENERATED_DIR, {
      recursive: true
    });

    const filename = `${randomUUID()}.wav`;
    const filepath = path.join(GENERATED_DIR, filename);

    await writeFile(filepath, audioBuffer);

    console.log("Speech audio saved:", filepath);

    return res.json({
      success: true,
      audioUrl: `/generated/${filename}`,
      message: "Speech generated successfully."
    });
  } catch (error) {
    console.error("Generate speech error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Speech generation failed."
    });
  }
});

// ==========================================
// MULTER ERROR HANDLER
// ==========================================

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "Each audio upload must be 20 MB or smaller."
          : error.message
    });
  }

  console.error("Unexpected server error:", error);

  return res.status(500).json({
    success: false,
    error: error.message || "Unexpected server error."
  });
});

// Serve the frontend after API routes.
app.use(express.static(PUBLIC_DIR));

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(
    `Voice Replication app: http://localhost:${PORT}`
  );
  console.log(`Project: ${PROJECT_ID}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Location: ${LOCATION}`);
});