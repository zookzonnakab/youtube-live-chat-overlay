(function () {
  window.OverlayClient = {
    getWsUrl() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${location.host}/ws`;
    },

    connect(clientType, onMessage) {
      const ws = new WebSocket(this.getWsUrl());
      let self = this;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "client:register", clientType }));
        setInterval(() => {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: "client:ping" }));
          }
        }, 10000);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data, ws);
      };

      ws.onclose = () => setTimeout(() => self.connect(clientType, onMessage), 3000);
      ws.onerror = () => ws.close();

      return ws;
    },

    applyOverlaySettings(settings) {
      const root = document.documentElement;
      root.style.setProperty("--scroll-font-size", `${settings.scrollFontSize}px`);
      root.style.setProperty("--scroll-max-messages", String(settings.scrollMaxMessages));
      root.style.setProperty("--featured-opacity", String(settings.featuredOpacity));
      root.style.setProperty("--featured-font-size", `${settings.featuredFontSize}px`);

      const container = document.getElementById("chat-container");
      if (container) {
        container.style.right = settings.scrollPosition === "right" ? "24px" : "auto";
        container.style.left = settings.scrollPosition === "left" ? "24px" : "auto";
        container.style.bottom = settings.scrollVertical === "bottom" ? "80px" : "50%";
        container.style.transform = settings.scrollVertical === "middle" ? "translateY(50%)" : "none";
      }

      const card = document.getElementById("featured-card");
      if (card) {
        card.style.background = `rgba(0, 0, 0, ${settings.featuredOpacity})`;
      }

      const body = document.getElementById("featured-body");
      if (body) {
        body.style.fontSize = `${settings.featuredFontSize}px`;
      }
    },
  };
})();
