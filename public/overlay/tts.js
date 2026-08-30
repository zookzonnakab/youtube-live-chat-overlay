(function () {
  const card = document.getElementById("tts-card");
  const categoryEl = document.getElementById("tts-category");
  const displayEl = document.getElementById("tts-display");
  const progressBar = document.getElementById("tts-progress-bar");

  let ws = null;
  let speaking = false;
  let progressTimer = null;

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

  function speak(payload) {
    if (speaking) {
      speechSynthesis.cancel();
    }

    speaking = true;
    card.classList.remove("hidden", "hiding");
    card.classList.add("category-" + payload.category);

    categoryEl.textContent = categoryLabels[payload.category] || payload.category;
    displayEl.textContent = payload.displayText;

    const utterance = new SpeechSynthesisUtterance(payload.speechText);
    utterance.lang = "th-TH";
    utterance.rate = payload.rate || 1;
    utterance.pitch = payload.pitch || 1;
    utterance.volume = payload.volume ?? 1;

    const voice = getThaiVoice();
    if (voice) utterance.voice = voice;

    const estDuration = Math.max(payload.speechText.length * 80, 2000);
    startProgress(estDuration);

    utterance.onend = () => {
      speaking = false;
      if (progressTimer) clearInterval(progressTimer);
      progressBar.style.width = "100%";
      setTimeout(() => {
        hideCard();
        sendDone();
      }, 400);
    };

    utterance.onerror = () => {
      speaking = false;
      if (progressTimer) clearInterval(progressTimer);
      hideCard();
      sendDone();
    };

    speechSynthesis.speak(utterance);
  }

  function connect() {
    ws = window.OverlayClient.connect("tts", (data) => {
      if (data.type === "tts:play") {
        speak(data.payload);
      }
    });
  }

  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => getThaiVoice();
  }

  connect();
})();
