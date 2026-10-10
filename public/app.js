
// const $ = (id) => document.getElementById(id);

// let currentVoiceId = localStorage.getItem("currentVoiceId") || "";
// const recordings = {
//   reference: null,
//   consent: null
// };

// const activeRecorders = {};
// let activeRecording = null;

// function setStatus(id, message, type = "") {
//   const element = $(id);
//   element.textContent = message;
//   element.className = `status ${type}`.trim();
  
// /* ==========================================
//    USE AN EXISTING VOICE ID
// ========================================== */

// $("useExistingVoice").addEventListener("click", () => {
//   const voiceId = $("existingVoiceId").value.trim();

//   if (!voiceId) {
//     setStatus(
//       "existingVoiceStatus",
//       "Please enter your existing Voice ID.",
//       "error"
//     );
//     return;
//   }

//   if (!/^voice_[A-Za-z0-9_-]+$/.test(voiceId)) {
//     setStatus(
//       "existingVoiceStatus",
//       "Invalid format. Your Voice ID must begin with voice_.",
//       "error"
//     );
//     return;
//   }

//   currentVoiceId = voiceId;

//   // Remember the selected Voice ID in this browser
//   localStorage.setItem("currentVoiceId", voiceId);

//   // Enable the speech generation button
//   $("generateSpeech").disabled = false;

//   setStatus(
//     "existingVoiceStatus",
//     "Voice ID selected successfully. You can now generate speech.",
//     "success"
//   );

//   setStatus(
//     "speechStatus",
//     "Ready to generate speech.",
//     "success"
//   );
// });
// }

// function updateCreateButton() {
//   $("createVoice").disabled =
//     !recordings.reference ||
//     !recordings.consent ||
//     Boolean(activeRecording);
// }

// function formatTime(seconds) {
//   const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
//   const secs = (seconds % 60).toString().padStart(2, "0");
//   return `${mins}:${secs}`;
// }

// function chooseMimeType() {
//   const types = [
//     "audio/webm;codecs=opus",
//     "audio/webm",
//     "audio/mp4"
//   ];

//   if (!window.MediaRecorder) {
//     throw new Error("Your browser does not support audio recording. Try a recent version of Chrome or Edge.");
//   }

//   return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
// }

// async function startRecording(kind) {
//   if (activeRecording) {
//     setStatus(
//       `${kind}Status`,
//       "Stop the current recording before starting another.",
//       "error"
//     );
//     return;
//   }

//   try {
//     const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
//     const mimeType = chooseMimeType();

//     const recorder = mimeType
//       ? new MediaRecorder(stream, { mimeType })
//       : new MediaRecorder(stream);

//     const chunks = [];
//     const startTime = Date.now();

//     activeRecording = kind;
//     activeRecorders[kind] = { recorder, stream, chunks, startTime };

//     const prefix = kind === "reference" ? "Reference" : "Consent";

//     $(`start${prefix}`).disabled = true;
//     $(`stop${prefix}`).disabled = false;
//     $(`redo${prefix}`).classList.add("hidden");
//     $(`${kind}Player`).classList.add("hidden");

//     recordings[kind] = null;
//     updateCreateButton();

//     setStatus(`${kind}Status`, "Recording... Speak clearly.");

//     if (kind === "reference") {
//       $("referenceTimer").textContent = "00:00";
//     }

//     recorder.addEventListener("dataavailable", event => {
//       if (event.data && event.data.size > 0) {
//         chunks.push(event.data);
//       }
//     });

//     recorder.addEventListener("stop", () => {
//       const durationSeconds = (Date.now() - startTime) / 1000;
//       const blobType = recorder.mimeType || mimeType || "audio/webm";
//       const blob = new Blob(chunks, { type: blobType });

//       stream.getTracks().forEach(track => track.stop());

//       activeRecorders[kind] = null;
//       activeRecording = null;

//       $(`start${prefix}`).disabled = false;
//       $(`stop${prefix}`).disabled = true;

//       if (kind === "reference") {
//         $("referenceTimer").textContent = formatTime(Math.round(durationSeconds));
//       }

//       if (blob.size === 0) {
//         recordings[kind] = null;
//         setStatus(`${kind}Status`, "No audio was captured. Please record again.", "error");
//         updateCreateButton();
//         return;
//       }

//       if (kind === "reference" &&
//           (durationSeconds < 10 || durationSeconds > 30)) {
//         recordings[kind] = null;
//         setStatus(
//           "referenceStatus",
//           `Your recording was ${Math.round(durationSeconds)} seconds. Record between 10 and 30 seconds, then try again.`,
//           "error"
//         );
//         updateCreateButton();
//         return;
//       }

//       recordings[kind] = blob;

//       const player = $(`${kind}Player`);
//       if (player.dataset.objectUrl) {
//         URL.revokeObjectURL(player.dataset.objectUrl);
//       }

//       const objectUrl = URL.createObjectURL(blob);
//       player.src = objectUrl;
//       player.dataset.objectUrl = objectUrl;
//       player.classList.remove("hidden");
//       $(`redo${kind === "reference" ? "Reference" : "Consent"}`).classList.remove("hidden");

//       setStatus(
//         `${kind}Status`,
//         `Recording ready (${Math.round(durationSeconds)} seconds). Play it back to check the quality.`,
//         "success"
//       );

//       updateCreateButton();
//     });

//     recorder.start();

//     if (kind === "reference") {
//       const timer = setInterval(() => {
//         if (activeRecording !== kind || recorder.state !== "recording") {
//           clearInterval(timer);
//           return;
//         }

//         const elapsed = Math.floor((Date.now() - startTime) / 1000);
//         $("referenceTimer").textContent = formatTime(elapsed);

//         if (elapsed >= 30) {
//           stopRecording(kind);
//           setStatus(
//             "referenceStatus",
//             "The 30-second recording limit was reached. Review the audio before continuing.",
//             "success"
//           );
//         }
//       }, 250);

//       activeRecorders[kind].timer = timer;
//     }
//   } catch (error) {
//     activeRecording = null;

//     const prefix = kind === "reference" ? "Reference" : "Consent";
//     $(`start${prefix}`).disabled = false;
//     $(`stop${prefix}`).disabled = true;

//     setStatus(
//       `${kind}Status`,
//       error.name === "NotAllowedError"
//         ? "Microphone access was denied. Allow microphone access in your browser settings and try again."
//         : error.message,
//       "error"
//     );

//     updateCreateButton();
//   }
// }

// function stopRecording(kind) {
//   const state = activeRecorders[kind];
//   if (!state || state.recorder.state !== "recording") return;

//   if (state.timer) clearInterval(state.timer);
//   state.recorder.stop();
// }

// $("startReference").addEventListener("click", () => startRecording("reference"));
// $("stopReference").addEventListener("click", () => stopRecording("reference"));
// $("redoReference").addEventListener("click", () => startRecording("reference"));

// $("startConsent").addEventListener("click", () => startRecording("consent"));
// $("stopConsent").addEventListener("click", () => stopRecording("consent"));
// $("redoConsent").addEventListener("click", () => startRecording("consent"));

// $("copyConsent").addEventListener("click", async () => {
//   try {
//     await navigator.clipboard.writeText($("consentText").textContent);
//     setStatus("consentStatus", "Consent statement copied.", "success");
//   } catch {
//     setStatus("consentStatus", "Select and copy the consent statement manually.");
//   }
// });

// $("copyVoiceId").addEventListener("click", async () => {
//   try {
//     await navigator.clipboard.writeText(currentVoiceId);
//     setStatus("createStatus", "Voice ID copied.", "success");
//   } catch {
//     setStatus("createStatus", "Please copy the voice ID manually.");
//   }
// });

// $("createVoice").addEventListener("click", async () => {
//   if (!recordings.reference || !recordings.consent) {
//     setStatus("createStatus", "Complete both recordings before continuing.", "error");
//     return;
//   }

//   const formData = new FormData();
//   const extension = blob =>
//     blob.type.includes("mp4") ? "m4a" : "webm";

//   formData.append(
//     "referenceAudio",
//     recordings.reference,
//     `reference.${extension(recordings.reference)}`
//   );
//   formData.append(
//     "consentAudio",
//     recordings.consent,
//     `consent.${extension(recordings.consent)}`
//   );
//   formData.append(
//     "displayName",
//     $("displayName").value.trim() || "My Replicated Voice"
//   );

//   $("createVoice").disabled = true;
//   $("voiceResult").classList.add("hidden");
//   setStatus("createStatus", "Uploading recordings and requesting voice replication...");

//   try {
//     const response = await fetch("/api/create-voice", {
//       method: "POST",
//       body: formData
//     });

//     const result = await response.json();

//     if (!response.ok || result.success !== true) {
//       throw new Error(result.error || `Request failed (${response.status})`);
//     }

    
// currentVoiceId = result.voiceId;

// // Remember the newly created Voice ID
// localStorage.setItem("currentVoiceId", currentVoiceId);

// // Display the new ID in the existing input field
// $("existingVoiceId").value = currentVoiceId;

// // Enable speech generation
// $("generateSpeech").disabled = false;

// // Display the new Voice ID
// $("voiceIdDisplay").textContent = currentVoiceId;

// setStatus(
//   "existingVoiceStatus",
//   "New Voice ID created and selected successfully.",
//   "success"
// );
//     $("voiceIdDisplay").textContent = currentVoiceId;
//     $("voiceResult").classList.remove("hidden");
//     $("generateSpeech").disabled = false;

//     setStatus("createStatus", result.message, "success");
//   } catch (error) {
//     setStatus("createStatus", error.message, "error");
//   } finally {
//     updateCreateButton();
//   }
// });

// $("generateSpeech").addEventListener("click", async () => {
//   const text = $("speechText").value.trim();

//   if (!currentVoiceId) {
//     setStatus("speechStatus", "Create your replicated voice first.", "error");
//     return;
//   }

//   if (!text) {
//     setStatus("speechStatus", "Enter the text you want to speak.", "error");
//     return;
//   }

//   $("generateSpeech").disabled = true;
//   $("audioResult").classList.add("hidden");
//   setStatus("speechStatus", "Generating speech with Gemini 3.8 Flash TTS...");

//   try {
//     const response = await fetch("/api/generate-speech", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ voiceId: currentVoiceId, text })
//     });

//     const result = await response.json();

//     if (!response.ok || result.success !== true) {
//       throw new Error(result.error || `Request failed (${response.status})`);
//     }

//     $("audioPlayer").src = `${result.audioUrl}?t=${Date.now()}`;
//     $("downloadAudio").href = result.audioUrl;
//     $("audioResult").classList.remove("hidden");

//     setStatus("speechStatus", result.message, "success");
//   } catch (error) {
//     setStatus("speechStatus", error.message, "error");
//   } finally {
//     $("generateSpeech").disabled = false;
//   }
// });

// if (!navigator.mediaDevices?.getUserMedia) {
//   setStatus(
//     "referenceStatus",
//     "Microphone recording is unavailable in this browser context. Open the app at http://localhost:3000 in a recent Chrome or Edge browser.",
//     "error"
//   );
// }

// fetch("/api/health")
//   .then(response => {
//     if (!response.ok) throw new Error("Backend health check failed.");
//     return response.json();
//   })
//   .then(result => console.log(result.message, result.model, result.location))
//   .catch(error => setStatus("createStatus", error.message, "error"));




const $ = (id) => document.getElementById(id);

let currentVoiceId = localStorage.getItem("currentVoiceId") || "";

const recordings = {
  reference: null,
  consent: null
};

const activeRecorders = {};
let activeRecording = null;

// ==========================================
// STATUS HELPER
// ==========================================

function setStatus(id, message, type = "") {
  const element = $(id);

  if (!element) {
    console.warn(`Status element not found: ${id}`);
    return;
  }

  element.textContent = message;
  element.className = `status ${type}`.trim();
}

// ==========================================
// VOICE ID VALIDATION
// ==========================================

function isValidVoiceId(voiceId) {
  return /^voice_[A-Za-z0-9_-]+$/.test(voiceId);
}

function selectVoiceId(voiceId) {
  currentVoiceId = voiceId;
  localStorage.setItem("currentVoiceId", voiceId);

  if ($("existingVoiceId")) {
    $("existingVoiceId").value = voiceId;
  }

  if ($("voiceIdDisplay")) {
    $("voiceIdDisplay").textContent = voiceId;
  }

  if ($("generateSpeech")) {
    $("generateSpeech").disabled = false;
  }
}

// ==========================================
// USE AN EXISTING VOICE ID
// ==========================================

$("useExistingVoice").addEventListener("click", () => {
  const voiceId = $("existingVoiceId").value.trim();

  if (!voiceId) {
    setStatus(
      "existingVoiceStatus",
      "Please enter your existing Voice ID.",
      "error"
    );
    return;
  }

  if (!isValidVoiceId(voiceId)) {
    setStatus(
      "existingVoiceStatus",
      "Invalid Voice ID format. The ID must begin with voice_.",
      "error"
    );
    return;
  }

  selectVoiceId(voiceId);

  setStatus(
    "existingVoiceStatus",
    "Voice ID selected successfully.",
    "success"
  );

  setStatus(
    "speechStatus",
    "Ready to generate speech.",
    "success"
  );
});

// ==========================================
// RESTORE SAVED VOICE ID
// ==========================================

if (currentVoiceId && isValidVoiceId(currentVoiceId)) {
  selectVoiceId(currentVoiceId);

  setStatus(
    "existingVoiceStatus",
    "Your previously selected Voice ID has been loaded.",
    "success"
  );
} else {
  currentVoiceId = "";
  localStorage.removeItem("currentVoiceId");
  $("generateSpeech").disabled = true;
}

// ==========================================
// RECORDING HELPERS
// ==========================================

function updateCreateButton() {
  $("createVoice").disabled =
    !recordings.reference ||
    !recordings.consent ||
    Boolean(activeRecording);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");

  return `${mins}:${secs}`;
}

function chooseMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4"
  ];

  if (!window.MediaRecorder) {
    throw new Error(
      "Your browser does not support audio recording. Try a recent version of Chrome or Edge."
    );
  }

  return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

// ==========================================
// START RECORDING
// ==========================================

async function startRecording(kind) {
  if (activeRecording) {
    setStatus(
      `${kind}Status`,
      "Stop the current recording before starting another.",
      "error"
    );
    return;
  }

  let stream;

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Microphone access is unavailable. Open the app using http://localhost:3000 in Chrome or Edge."
      );
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });

    const mimeType = chooseMimeType();

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    const chunks = [];
    const startTime = Date.now();

    activeRecording = kind;

    activeRecorders[kind] = {
      recorder,
      stream,
      chunks,
      startTime,
      timer: null
    };

    const prefix = kind === "reference" ? "Reference" : "Consent";

    $(`start${prefix}`).disabled = true;
    $(`stop${prefix}`).disabled = false;
    $(`redo${prefix}`).classList.add("hidden");
    $(`${kind}Player`).classList.add("hidden");

    recordings[kind] = null;
    updateCreateButton();

    setStatus(
      `${kind}Status`,
      "Recording... Speak clearly."
    );

    if (kind === "reference") {
      $("referenceTimer").textContent = "00:00";
    }

    recorder.addEventListener("dataavailable", event => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const blobType = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: blobType });

      stream.getTracks().forEach(track => track.stop());

      activeRecorders[kind] = null;
      activeRecording = null;

      $(`start${prefix}`).disabled = false;
      $(`stop${prefix}`).disabled = true;

      if (kind === "reference") {
        $("referenceTimer").textContent =
          formatTime(Math.round(durationSeconds));
      }

      if (blob.size === 0) {
        recordings[kind] = null;

        setStatus(
          `${kind}Status`,
          "No audio was captured. Please record again.",
          "error"
        );

        updateCreateButton();
        return;
      }

      if (
        kind === "reference" &&
        (durationSeconds < 10 || durationSeconds > 30)
      ) {
        recordings[kind] = null;

        setStatus(
          "referenceStatus",
          `Your recording was ${Math.round(durationSeconds)} seconds. Record between 10 and 30 seconds, then try again.`,
          "error"
        );

        updateCreateButton();
        return;
      }

      recordings[kind] = blob;

      const player = $(`${kind}Player`);

      if (player.dataset.objectUrl) {
        URL.revokeObjectURL(player.dataset.objectUrl);
      }

      const objectUrl = URL.createObjectURL(blob);

      player.src = objectUrl;
      player.dataset.objectUrl = objectUrl;
      player.classList.remove("hidden");

      const redoButtonId =
        kind === "reference" ? "redoReference" : "redoConsent";

      $(redoButtonId).classList.remove("hidden");

      setStatus(
        `${kind}Status`,
        `Recording ready (${Math.round(durationSeconds)} seconds). Play it back to check the quality.`,
        "success"
      );

      updateCreateButton();
    });

    recorder.start();

    // Reference recording: maximum 30 seconds
    if (kind === "reference") {
      const timer = setInterval(() => {
        if (
          activeRecording !== kind ||
          recorder.state !== "recording"
        ) {
          clearInterval(timer);
          return;
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        $("referenceTimer").textContent = formatTime(elapsed);

        if (elapsed >= 30) {
          stopRecording(kind);
        }
      }, 250);

      activeRecorders[kind].timer = timer;
    }
  } catch (error) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    activeRecording = null;
    activeRecorders[kind] = null;

    const prefix = kind === "reference" ? "Reference" : "Consent";

    $(`start${prefix}`).disabled = false;
    $(`stop${prefix}`).disabled = true;

    setStatus(
      `${kind}Status`,
      error.name === "NotAllowedError"
        ? "Microphone access was denied. Allow microphone access in your browser settings and try again."
        : error.message,
      "error"
    );

    updateCreateButton();
  }
}

// ==========================================
// STOP RECORDING
// ==========================================

function stopRecording(kind) {
  const state = activeRecorders[kind];

  if (!state || state.recorder.state !== "recording") {
    return;
  }

  if (state.timer) {
    clearInterval(state.timer);
  }

  state.recorder.stop();
}

// ==========================================
// RECORDING BUTTONS
// ==========================================

$("startReference").addEventListener("click", () => {
  startRecording("reference");
});

$("stopReference").addEventListener("click", () => {
  stopRecording("reference");
});

$("redoReference").addEventListener("click", () => {
  startRecording("reference");
});

$("startConsent").addEventListener("click", () => {
  startRecording("consent");
});

$("stopConsent").addEventListener("click", () => {
  stopRecording("consent");
});

$("redoConsent").addEventListener("click", () => {
  startRecording("consent");
});

// ==========================================
// COPY CONSENT STATEMENT
// ==========================================

$("copyConsent").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(
      $("consentText").textContent
    );

    setStatus(
      "consentStatus",
      "Consent statement copied.",
      "success"
    );
  } catch {
    setStatus(
      "consentStatus",
      "Select and copy the consent statement manually."
    );
  }
});

// ==========================================
// COPY VOICE ID
// ==========================================

$("copyVoiceId").addEventListener("click", async () => {
  if (!currentVoiceId) {
    setStatus(
      "createStatus",
      "No Voice ID is available to copy.",
      "error"
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(currentVoiceId);

    setStatus(
      "createStatus",
      "Voice ID copied.",
      "success"
    );
  } catch {
    setStatus(
      "createStatus",
      "Please copy the Voice ID manually."
    );
  }
});

// ==========================================
// CREATE A NEW REPLICATED VOICE
// ==========================================

$("createVoice").addEventListener("click", async () => {
  if (!recordings.reference || !recordings.consent) {
    setStatus(
      "createStatus",
      "Complete both recordings before continuing.",
      "error"
    );
    return;
  }

  const formData = new FormData();

  const extension = blob =>
    blob.type.includes("mp4") ? "m4a" : "webm";

  formData.append(
    "referenceAudio",
    recordings.reference,
    `reference.${extension(recordings.reference)}`
  );

  formData.append(
    "consentAudio",
    recordings.consent,
    `consent.${extension(recordings.consent)}`
  );

  formData.append(
    "displayName",
    $("displayName").value.trim() || "My Replicated Voice"
  );

  $("createVoice").disabled = true;
  $("voiceResult").classList.add("hidden");

  setStatus(
    "createStatus",
    "Uploading recordings and requesting voice replication..."
  );

  try {
    const response = await fetch("/api/create-voice", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.error || `Request failed (${response.status})`
      );
    }

    if (!result.voiceId || !isValidVoiceId(result.voiceId)) {
      throw new Error(
        "The server did not return a valid Voice ID."
      );
    }

    selectVoiceId(result.voiceId);

    $("voiceResult").classList.remove("hidden");

    setStatus(
      "existingVoiceStatus",
      "New Voice ID created and selected successfully.",
      "success"
    );

    setStatus(
      "createStatus",
      result.message || "Voice replication completed successfully.",
      "success"
    );

    setStatus(
      "speechStatus",
      "Your new voice is ready. Enter text and generate speech.",
      "success"
    );
  } catch (error) {
    setStatus("createStatus", error.message, "error");
  } finally {
    updateCreateButton();
  }
});

// ==========================================
// GENERATE SPEECH
// ==========================================

$("generateSpeech").addEventListener("click", async () => {
  const text = $("speechText").value.trim();

  if (!currentVoiceId) {
    setStatus(
      "speechStatus",
      "Enter an existing Voice ID or create a new voice first.",
      "error"
    );
    return;
  }

  if (!text) {
    setStatus(
      "speechStatus",
      "Enter the text you want to speak.",
      "error"
    );
    return;
  }

  $("generateSpeech").disabled = true;
  $("audioResult").classList.add("hidden");

  setStatus(
    "speechStatus",
    "Generating speech with Gemini 3.8 Flash TTS..."
  );

  try {
    const response = await fetch("/api/generate-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        voiceId: currentVoiceId,
        text
      })
    });

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.error || `Request failed (${response.status})`
      );
    }

    $("audioPlayer").src =
      `${result.audioUrl}?t=${Date.now()}`;

    $("downloadAudio").href = result.audioUrl;
    $("audioResult").classList.remove("hidden");

    setStatus(
      "speechStatus",
      result.message || "Speech generated successfully.",
      "success"
    );
  } catch (error) {
    setStatus("speechStatus", error.message, "error");
  } finally {
    $("generateSpeech").disabled = !currentVoiceId;
  }
});

// ==========================================
// CHECK MICROPHONE AVAILABILITY
// ==========================================

if (!navigator.mediaDevices?.getUserMedia) {
  setStatus(
    "referenceStatus",
    "Microphone recording is unavailable. Open the app at http://localhost:3000 in a recent Chrome or Edge browser.",
    "error"
  );
}

// ==========================================
// CHECK BACKEND HEALTH
// ==========================================

fetch("/api/health")
  .then(async response => {
    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.error || "Backend health check failed."
      );
    }

    console.log(
      result.message,
      result.model,
      result.location
    );
  })
  .catch(error => {
    setStatus("createStatus", error.message, "error");
  });