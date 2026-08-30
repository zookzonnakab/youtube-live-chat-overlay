(function () {
  const container = document.getElementById("chat-container");
  const seenIds = new Set();
  let maxVisible = 15;

  function createLine(message) {
    const line = document.createElement("div");
    line.className = "chat-line";
    line.dataset.id = message.id;

    const username = document.createElement("span");
    username.className = "chat-username";
    username.style.color = message.color;
    username.textContent = `@${message.author.name}`;
    line.appendChild(username);

    if (message.author.badgeUrl) {
      const badge = document.createElement("img");
      badge.className = "chat-badge";
      badge.src = message.author.badgeUrl;
      badge.alt = message.author.badgeLabel || "badge";
      line.appendChild(badge);
    }

    const text = document.createElement("span");
    text.className = "chat-text";
    text.innerHTML = " " + message.html;
    line.appendChild(text);

    return line;
  }

  function trimOldMessages() {
    const lines = container.querySelectorAll(".chat-line");
    if (lines.length <= maxVisible) return;

    const excess = lines.length - maxVisible;
    for (let i = 0; i < excess; i++) {
      const el = lines[i];
      el.classList.add("fade-out");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }
  }

  function addMessage(message) {
    if (seenIds.has(message.id)) return;
    seenIds.add(message.id);

    const line = createLine(message);
    container.appendChild(line);
    trimOldMessages();
  }

  function handleMessage(data) {
    if (data.type === "chat:history") {
      if (data.payload.overlaySettings) {
        maxVisible = data.payload.overlaySettings.scrollMaxMessages;
        window.OverlayClient.applyOverlaySettings(data.payload.overlaySettings);
      }
      for (const msg of data.payload.messages) {
        addMessage(msg);
      }
    } else if (data.type === "chat:new") {
      addMessage(data.payload.message);
    } else if (data.type === "overlay:settings") {
      maxVisible = data.payload.scrollMaxMessages;
      window.OverlayClient.applyOverlaySettings(data.payload);
    }
  }

  window.OverlayClient.connect("scroll", handleMessage);
})();
