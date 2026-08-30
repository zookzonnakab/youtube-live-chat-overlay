(function () {
  const card = document.getElementById("featured-card");
  const avatar = document.getElementById("featured-avatar");
  const username = document.getElementById("featured-username");
  const badge = document.getElementById("featured-badge");
  const badgeLabel = document.getElementById("featured-badge-label");
  const body = document.getElementById("featured-body");

  function showFeatured(message) {
    if (!message) {
      card.classList.add("hidden");
      return;
    }

    card.classList.remove("hidden");
    card.classList.remove("updating");
    void card.offsetWidth;
    card.classList.add("updating");

    username.textContent = `@${message.author.name}`;
    body.innerHTML = message.html;

    if (message.author.avatarUrl) {
      avatar.src = message.author.avatarUrl;
      avatar.classList.remove("hidden");
    } else {
      avatar.src = "";
      avatar.classList.add("hidden");
    }

    if (message.author.badgeUrl) {
      badge.src = message.author.badgeUrl;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }

    if (message.author.badgeLabel) {
      badgeLabel.textContent = message.author.badgeLabel;
      badgeLabel.classList.remove("hidden");
    } else {
      badgeLabel.classList.add("hidden");
    }
  }

  function handleMessage(data) {
    if (data.type === "chat:history") {
      if (data.payload.overlaySettings) {
        window.OverlayClient.applyOverlaySettings(data.payload.overlaySettings);
      }
      showFeatured(data.payload.featured);
    } else if (data.type === "featured:update") {
      showFeatured(data.payload.message);
    } else if (data.type === "overlay:settings") {
      window.OverlayClient.applyOverlaySettings(data.payload);
    }
  }

  window.OverlayClient.connect("featured", handleMessage);
})();
