(function () {
  const card = document.getElementById("tts-card");
  const categoryEl = document.getElementById("tts-category");
  const displayEl = document.getElementById("tts-display");
  const progressBar = document.getElementById("tts-progress-bar");
  const unlockEl = document.getElementById("tts-unlock");
  const audioEl = document.getElementById("tts-audio");

  const SILENT_WAV =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

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
    if (typeof speechSynthesis === "undefined") return null;
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

  function showUnlock() {
    unlockEl.classList.add("visible");
  }

  function hideUnlock() {
    unlockEl.classList.remove("visible");
  }

  function speakWithWebSpeech(payload) {
    if (typeof speechSynthesis === "undefined") {
      finishSpeak();
      return;
    }
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

  async function playAudioElement() {
    // 1) Normal play
    try {
      audioEl.muted = false;
      await audioEl.play();
      return true;
    } catch (_) {}

    // 2) Muted unlock then unmute (works in many Chromium/OBS builds)
    try {
      audioEl.muted = true;
      await audioEl.play();
      audioEl.muted = false;
      return true;
    } catch (_) {}

    return false;
  }

  async function speakWithAudio(payload) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.volume = Math.min(Math.max(payload.volume ?? 1, 0), 1);
    audioEl.src = payload.audioUrl + "?t=" + Date.now();

    audioEl.onloadedmetadata = () => {
      const dur =
        Number.isFinite(audioEl.duration) && audioEl.duration > 0
          ? audioEl.duration * 1000
          : Math.max(payload.speechText.length * 80, 2500);
      startProgress(dur);
    };
    audioEl.onended = () => finishSpeak();
    audioEl.onerror = () => {
      console.warn("audio error, fallback Web Speech");
      speakWithWebSpeech(payload);
    };

    const ok = await playAudioElement();
    if (ok) {
      audioUnlocked = true;
      hideUnlock();
      return;
    }

    // Still blocked — need OBS Interact / one click
    pendingPayload = payload;
    speaking = false;
    showUnlock();
  }

  function speak(payload) {
    if (speaking) {
      try {
        speechSynthesis.cancel();
      } catch (_) {}
      try {
        audioEl.pause();
      } catch (_) {}
    }

    speaking = true;
    showCard(payload);

    if (payload.audioUrl) {
      void speakWithAudio(payload);
    } else {
      speakWithWebSpeech(payload);
    }
  }

  async function unlockAudio() {
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
      audioEl.muted = true;
      audioEl.src = SILENT_WAV;
      await audioEl.play();
      audioEl.pause();
      audioEl.muted = false;
      audioEl.removeAttribute("src");
    } catch (_) {}

    audioUnlocked = true;
    hideUnlock();

    if (pendingPayload) {
      const p = pendingPayload;
      pendingPayload = null;
      speak(p);
    }
  }

  function bindUnlock() {
    const handler = () => {
      void unlockAudio();
    };
    unlockEl.addEventListener("click", handler);
    unlockEl.addEventListener("pointerdown", handler);
    unlockEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") handler();
    });
    document.addEventListener("pointerdown", () => {
      if (!audioUnlocked) void unlockAudio();
    });
  }

  async function tryAutoUnlock() {
    try {
      audioEl.muted = true;
      audioEl.src = SILENT_WAV;
      await audioEl.play();
      audioEl.pause();
      audioEl.muted = false;
      audioEl.removeAttribute("src");
      audioUnlocked = true;
      hideUnlock();
      return true;
    } catch (_) {
      return false;
    }
  }

  function connect() {
    ws = window.OverlayClient.connect("tts", (data) => {
      if (data.type === "tts:play") {
        speak(data.payload);
      }
    });
  }

  if (typeof speechSynthesis !== "undefined" && speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => getThaiVoice();
  }

  bindUnlock();
  connect();

  // Try silent unlock (no yellow button unless needed)
  void tryAutoUnlock().then((ok) => {
    if (!ok) {
      // Keep unlock hidden until a play is actually blocked
      hideUnlock();
    }
  });
})();
