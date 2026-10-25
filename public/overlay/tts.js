(function () {
  const card = document.getElementById("tts-card");
  const categoryEl = document.getElementById("tts-category");
  const displayEl = document.getElementById("tts-display");
  const progressBar = document.getElementById("tts-progress-bar");
  const unlockBtn = document.getElementById("tts-unlock");
  const audioEl = document.getElementById("tts-audio");

  let ws = null;
  let speaking = false;
  let audioUnlocked = false;
  let progressTimer = null;
  let pendingPayload = null;

  const categoryLabels = {
    member: "สมาชิก",
    superchat: "Super Chat",
    "member-superchat": "สมาชิก + Super Chat",
  };

  function getThaiVoice() {
    const voices = speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang.startsWith("th")) ||
      voices.find((v) => v.lang.includes("TH")) ||
      voices[0]
    );
  }

  function sendDone() {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "tts:done" }));
    }
  }

  function hideCard() {
    card.classList.add("hiding");
    setTimeout(() => {
      card.classList.add("hidden");
      card.classList.remove("hiding");
      card.classList.remove("category-member", "category-superchat", "category-member-superchat");
    }, 300);
  }

  function startProgress(durationMs) {
    if (progressTimer) clearInterval(progressTimer);
    const start = Date.now();
    progressBar.style.width = "0%";
    progressTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      progressBar.style.width = pct + "%";
      if (pct >= 100) clearInterval(progressTimer);
    }, 50);
  }

  function finishSpeak() {
    speaking = false;
    if (progressTimer) clearInterval(progressTimer);
    progressBar.style.width = "100%";
    setTimeout(() => {
      hideCard();
      sendDone();
    }, 500);
  }

  function showCard(payload) {
    card.classList.remove("hidden", "hiding");
    card.classList.add("category-" + payload.category);
    categoryEl.textContent = categoryLabels[payload.category] || payload.category;
    displayEl.textContent = payload.displayText;
  }

  function speakWithWebSpeech(payload) {
    try {
      speechSynthesis.cancel();
    } catch (_) {}

    const utterance = new SpeechSynthesisUtterance(payload.speechText);
    utterance.lang = "th-TH";
    utterance.rate = payload.rate || 1;
    utterance.pitch = payload.pitch || 1;
    utterance.volume = payload.volume ?? 1;
    const voice = getThaiVoice();
    if (voice) utterance.voice = voice;

    const estDuration = Math.max(payload.speechText.length * 80, 2500);
    startProgress(estDuration);

    utterance.onend = () => finishSpeak();
    utterance.onerror = () => finishSpeak();
    speechSynthesis.speak(utterance);
  }

  function speakWithAudio(payload) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.volume = Math.min(Math.max(payload.volume ?? 1, 0), 1);
    audioEl.src = payload.audioUrl + "?t=" + Date.now();

    const onMeta = () => {
      const dur = Number.isFinite(audioEl.duration) && audioEl.duration > 0
        ? audioEl.duration * 1000
        : Math.max(payload.speechText.length * 80, 2500);
      startProgress(dur);
    };

    audioEl.onloadedmetadata = onMeta;
    audioEl.onended = () => finishSpeak();
    audioEl.onerror = () => {
      console.warn("audio play failed, falling back to Web Speech");
      speakWithWebSpeech(payload);
    };

    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.catch(() => {
        // Autoplay blocked — keep payload and wait for unlock click
        pendingPayload = payload;
        speaking = false;
        unlockBtn.classList.add("visible");
        unlockBtn.textContent = "คลิกเพื่อเล่นเสียง TTS";
      });
    }
  }

  function speak(payload) {
    if (speaking) {
      try { speechSynthesis.cancel(); } catch (_) {}
      try { audioEl.pause(); } catch (_) {}
    }

    speaking = true;
    showCard(payload);

    if (payload.audioUrl) {
      speakWithAudio(payload);
    } else {
      speakWithWebSpeech(payload);
    }
  }

  async function unlockAudio() {
    unlockBtn.classList.remove("visible");
    audioUnlocked = true;

    // Unlock HTML5 audio + AudioContext for Chrome/OBS
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (_) {}

    try {
      audioEl.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      audioEl.volume = 0.01;
      await audioEl.play();
      audioEl.pause();
      audioEl.removeAttribute("src");
    } catch (_) {}

    if (pendingPayload) {
      const p = pendingPayload;
      pendingPayload = null;
      speak(p);
    }
  }

  unlockBtn.addEventListener("click", () => {
    void unlockAudio();
  });

  // OBS / some embeds allow gesture-less play after first load attempt
  document.addEventListener(
    "click",
    () => {
      if (!audioUnlocked) void unlockAudio();
    },
    { once: true }
  );

  function connect() {
    ws = window.OverlayClient.connect("tts", (data) => {
      if (data.type === "tts:play") {
        if (!audioUnlocked && data.payload.audioUrl) {
          // Try play anyway (OBS often allows); show unlock if blocked
          speak(data.payload);
          return;
        }
        speak(data.payload);
      }
    });
  }

  if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => getThaiVoice();
  }

  // Show unlock hint briefly for Chrome users
  unlockBtn.classList.add("visible");
  setTimeout(() => {
    if (audioUnlocked) unlockBtn.classList.remove("visible");
  }, 8000);

  connect();
})();
