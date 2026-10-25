(function () {
  const $ = (id) => document.getElementById(id);

  const state = {
    messages: new Map(),
    featuredId: null,
    featuredMessage: null,
    featuredHistory: [],
    selectedIndex: -1,
    filter: "all",
    search: "",
    overlaySettings: {},
    dashboardSettings: {},
    ws: null,
    pollTimer: null,
    configured: false,
    wizardStep: 1,
  };

  const baseUrl = location.origin;

  function getWsUrl() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${location.host}/ws`;
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  function playSound(kind) {
    if (!state.dashboardSettings.soundEnabled) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === "superchat" ? 880 : kind === "member" ? 660 : 520;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  }

  function getFilteredMessages() {
    let list = Array.from(state.messages.values()).sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    if (state.filter === "member") {
      list = list.filter((m) => m.author.isMember);
    } else if (state.filter === "superchat") {
      list = list.filter((m) => m.superchat);
    }

    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (m) =>
          m.author.name.toLowerCase().includes(q) ||
          m.text.toLowerCase().includes(q)
      );
    }

    return list;
  }

  function createChatRow(msg) {
    const row = document.createElement("div");
    row.className = "chat-row";
    row.dataset.id = msg.id;

    if (msg.author.avatarUrl) {
      const av = document.createElement("img");
      av.className = "chat-row-avatar";
      av.src = msg.author.avatarUrl;
      av.alt = msg.author.name;
      row.appendChild(av);
    }

    const content = document.createElement("div");
    content.className = "chat-row-content";

    const header = document.createElement("div");
    header.className = "chat-row-header";

    const name = document.createElement("span");
    name.className = "chat-row-username";
    name.style.color = msg.color;
    name.textContent = `@${msg.author.name}`;
    header.appendChild(name);

    if (msg.author.badgeUrl) {
      const badge = document.createElement("img");
      badge.className = "chat-row-badge";
      badge.src = msg.author.badgeUrl;
      badge.alt = "";
      header.appendChild(badge);
    }

    if (msg.superchat) {
      const sc = document.createElement("span");
      sc.className = "chat-row-superchat";
      sc.textContent = msg.superchat.amount;
      header.appendChild(sc);
    }

    const time = document.createElement("span");
    time.className = "chat-row-time";
    time.textContent = formatTime(msg.timestamp);
    header.appendChild(time);

    const text = document.createElement("div");
    text.className = "chat-row-text";
    text.innerHTML = msg.html;

    content.appendChild(header);
    content.appendChild(text);
    row.appendChild(content);

    row.addEventListener("click", () => setFeatured(msg.id));
    return row;
  }

  function renderFeed() {
    const feed = $("chat-feed");
    const list = getFilteredMessages();

    if (list.length === 0) {
      feed.innerHTML = '<div class="empty-state">ยังไม่มีข้อความ</div>';
      state.selectedIndex = -1;
      return;
    }

    feed.innerHTML = "";
    list.forEach((msg, i) => {
      const row = createChatRow(msg);
      if (msg.id === state.featuredId) row.classList.add("featured");
      if (i === state.selectedIndex) row.classList.add("selected");
      feed.appendChild(row);
    });

    feed.scrollTop = feed.scrollHeight;
    renderPreviewScroll(list.slice(-5));
  }

  function renderPreviewScroll(messages) {
    const el = $("preview-scroll");
    el.innerHTML = "";
    for (const msg of messages) {
      const line = document.createElement("div");
      line.className = "chat-line";
      line.innerHTML = `<span style="color:${msg.color};font-weight:600">@${msg.author.name}</span> <span style="color:#fff">${msg.html}</span>`;
      el.appendChild(line);
    }
  }

  function renderFeaturedBar() {
    const bar = $("featured-bar");
    if (!state.featuredMessage) {
      bar.classList.add("hidden");
      $("preview-featured").classList.add("hidden");
      $("preview-featured-empty").classList.remove("hidden");
      return;
    }

    bar.classList.remove("hidden");
    const msg = state.featuredMessage;

    $("featured-bar-user").textContent = `@${msg.author.name}`;
    $("featured-bar-msg").textContent = msg.text;

    const av = $("featured-bar-avatar");
    if (msg.author.avatarUrl) {
      av.src = msg.author.avatarUrl;
      av.classList.remove("hidden");
    } else {
      av.classList.add("hidden");
    }

    $("preview-featured").classList.remove("hidden");
    $("preview-featured-empty").classList.add("hidden");
    $("preview-f-user").textContent = `@${msg.author.name}`;
    $("preview-f-body").innerHTML = msg.html;

    const pav = $("preview-f-avatar");
    if (msg.author.avatarUrl) {
      pav.src = msg.author.avatarUrl;
      pav.classList.remove("hidden");
    } else {
      pav.classList.add("hidden");
    }
  }

  function renderHistory() {
    const el = $("featured-history");
    if (state.featuredHistory.length === 0) {
      el.innerHTML = '<div class="preview-empty">ยังไม่มีประวัติ</div>';
      return;
    }

    el.innerHTML = "";
    for (const msg of state.featuredHistory) {
      const item = document.createElement("div");
      item.className = "history-item";
      item.textContent = `@${msg.author.name}: ${msg.text.slice(0, 50)}`;
      item.addEventListener("click", () => setFeatured(msg.id));
      el.appendChild(item);
    }
  }

  function updateStatus(status) {
    const badge = $("status-badge");
    if (status.live) {
      badge.textContent = "ไลฟ์";
      badge.className = "status-badge status-online";
    } else {
      badge.textContent = status.running ? "กำลังเชื่อมต่อ..." : "ออฟไลน์";
      badge.className = "status-badge status-offline";
    }
    $("status-live").textContent = `ไลฟ์: ${status.live ? "ใช่" : "ไม่"}`;
    $("status-liveId").textContent = `Live ID: ${status.liveId || "-"}`;
    $("status-count").textContent = `ข้อความ: ${status.messageCount || 0}`;
    $("status-error").textContent = status.error || "";
  }

  function updateSystemStatus(sys) {
    $("ind-ws").classList.toggle("on", sys.wsConnected > 0);
    $("ind-chat").classList.toggle("on", sys.chatIngestRunning);
    $("ind-scroll").classList.toggle("on", sys.scrollOverlayConnected);
    $("ind-featured").classList.toggle("on", sys.featuredOverlayConnected);
    $("ind-tts").classList.toggle("on", sys.ttsOverlayConnected);
  }

  function updateTtsQueue(status) {
    const playing = status.playing ? "กำลังอ่าน" : "ว่าง";
    $("tts-queue-status").textContent =
      `คิว: ${status.queueLength} · ${playing} · ข้าม: ${status.skipped || 0}`;
  }

  function addMessage(msg) {
    state.messages.set(msg.id, msg);
    if (state.messages.size > 200) {
      const oldest = Array.from(state.messages.values()).sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      )[0];
      if (oldest) state.messages.delete(oldest.id);
    }
    renderFeed();
  }

  async function setFeatured(messageId) {
    const res = await fetch("/api/featured", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (res.ok) {
      const data = await res.json();
      state.featuredId = messageId;
      state.featuredMessage = data.message;
      renderFeed();
      renderFeaturedBar();
    }
  }

  async function clearFeatured() {
    await fetch("/api/featured", { method: "DELETE" });
    state.featuredId = null;
    state.featuredMessage = null;
    renderFeed();
    renderFeaturedBar();
  }

  async function undoFeatured() {
    const res = await fetch("/api/featured/undo", { method: "POST" });
    const data = await res.json();
    state.featuredMessage = data.message;
    state.featuredId = data.message?.id || null;
    renderFeed();
    renderFeaturedBar();
    renderHistory();
  }

  async function saveConfig(extra = {}) {
    // Do not send empty ID fields — they used to wipe values parsed from youtubeUrl.
    const body = {
      chatType: $("chatType").value,
      ...extra,
    };
    const youtubeUrl = (extra.youtubeUrl || $("youtube-url").value || "").trim();
    if (youtubeUrl) body.youtubeUrl = youtubeUrl;
    const channelId = $("channelId").value.trim();
    const handle = $("handle").value.trim();
    const liveId = $("liveId").value.trim();
    if (channelId) body.channelId = channelId;
    if (handle) body.handle = handle;
    if (liveId) body.liveId = liveId;

    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      $("status-error").textContent = err.error || "บันทึกไม่สำเร็จ";
      return false;
    }

    const config = await res.json();
    state.configured = config.configured;
    state.messages.clear();
    renderFeed();
    $("status-error").textContent = "";
    return true;
  }

  async function saveOverlaySettings() {
    const settings = {
      scrollFontSize: parseInt($("scrollFontSize").value, 10),
      scrollMaxMessages: parseInt($("scrollMaxMessages").value, 10),
      scrollPosition: $("scrollPosition").value,
      scrollVertical: $("scrollVertical").value,
      featuredOpacity: parseFloat($("featuredOpacity").value),
      featuredFontSize: parseInt($("featuredFontSize").value, 10),
    };

    await fetch("/api/overlay-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  }

  async function saveDashboardSettings() {
    const settings = {
      soundEnabled: $("soundEnabled").checked,
      soundSuperchat: $("soundSuperchat").checked,
      soundMember: $("soundMember").checked,
      autoFeatureKeywords: $("autoFeatureKeywords").value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      ttsEnabled: $("ttsEnabled").checked,
      ttsMember: $("ttsMember").checked,
      ttsSuperchat: $("ttsSuperchat").checked,
      ttsMemberSuperchat: $("ttsMemberSuperchat").checked,
      ttsRate: parseFloat($("ttsRate").value),
      ttsPitch: 1,
      ttsVolume: parseFloat($("ttsVolume").value),
      ttsMaxTextLength: 200,
    };

    await fetch("/api/dashboard-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  }

  function loadOverlaySettingsUI(settings) {
    state.overlaySettings = settings;
    $("scrollFontSize").value = settings.scrollFontSize;
    $("scrollFontSize-val").textContent = `${settings.scrollFontSize}px`;
    $("scrollMaxMessages").value = settings.scrollMaxMessages;
    $("scrollMaxMessages-val").textContent = settings.scrollMaxMessages;
    $("scrollPosition").value = settings.scrollPosition;
    $("scrollVertical").value = settings.scrollVertical;
    $("featuredOpacity").value = settings.featuredOpacity;
    $("featuredOpacity-val").textContent = settings.featuredOpacity;
    $("featuredFontSize").value = settings.featuredFontSize;
    $("featuredFontSize-val").textContent = `${settings.featuredFontSize}px`;
  }

  function loadDashboardSettingsUI(settings) {
    state.dashboardSettings = settings;
    $("soundEnabled").checked = settings.soundEnabled;
    $("soundSuperchat").checked = settings.soundSuperchat;
    $("soundMember").checked = settings.soundMember;
    $("autoFeatureKeywords").value = (settings.autoFeatureKeywords || []).join(", ");
    $("ttsEnabled").checked = settings.ttsEnabled ?? false;
    $("ttsMember").checked = settings.ttsMember ?? true;
    $("ttsSuperchat").checked = settings.ttsSuperchat ?? true;
    $("ttsMemberSuperchat").checked = settings.ttsMemberSuperchat ?? true;
    $("ttsRate").value = settings.ttsRate ?? 1;
    $("ttsRate-val").textContent = settings.ttsRate ?? 1;
    $("ttsVolume").value = settings.ttsVolume ?? 1;
    $("ttsVolume-val").textContent = settings.ttsVolume ?? 1;
  }

  function showWizard() {
    $("wizard").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    $("wizard-scroll-url").textContent = `${baseUrl}/overlay/scroll`;
    $("wizard-featured-url").textContent = `${baseUrl}/overlay/featured`;
    $("wizard-tts-url").textContent = `${baseUrl}/overlay/tts`;
  }

  function showDashboard() {
    $("wizard").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
  }

  function wizardGoTo(step) {
    state.wizardStep = step;
    document.querySelectorAll(".wizard-step").forEach((el) => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.toggle("active", s === step);
      el.classList.toggle("done", s < step);
    });
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
  }

  function handleKeyboard(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

    const list = getFilteredMessages();
    if (list.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.selectedIndex = Math.min(state.selectedIndex + 1, list.length - 1);
      renderFeed();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.selectedIndex = Math.max(state.selectedIndex - 1, 0);
      renderFeed();
    } else if (e.key === "Enter" && state.selectedIndex >= 0) {
      e.preventDefault();
      setFeatured(list[state.selectedIndex].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      clearFeatured();
    }
  }

  function connectWs() {
    if (state.ws) state.ws.close();

    state.ws = new WebSocket(getWsUrl());

    state.ws.onopen = () => {
      state.ws.send(JSON.stringify({ type: "client:register", clientType: "dock" }));
      if (state.pollTimer) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
      }
    };

    state.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "chat:history":
          for (const msg of data.payload.messages) state.messages.set(msg.id, msg);
          if (data.payload.featured) {
            state.featuredId = data.payload.featured.id;
            state.featuredMessage = data.payload.featured;
          }
          if (data.payload.overlaySettings) loadOverlaySettingsUI(data.payload.overlaySettings);
          if (data.payload.dashboardSettings) loadDashboardSettingsUI(data.payload.dashboardSettings);
          if (data.payload.featuredHistory) state.featuredHistory = data.payload.featuredHistory;
          renderFeed();
          renderFeaturedBar();
          renderHistory();
          break;
        case "chat:new":
          addMessage(data.payload.message);
          break;
        case "featured:update":
          state.featuredId = data.payload.message?.id || null;
          state.featuredMessage = data.payload.message;
          renderFeed();
          renderFeaturedBar();
          break;
        case "featured:history":
          state.featuredHistory = data.payload.history;
          renderHistory();
          break;
        case "status:update":
          updateStatus(data.payload);
          break;
        case "system:status":
          updateSystemStatus(data.payload);
          break;
        case "overlay:settings":
          loadOverlaySettingsUI(data.payload);
          break;
        case "dashboard:settings":
          loadDashboardSettingsUI(data.payload);
          break;
        case "notification":
          playSound(data.payload.kind);
          break;
        case "tts:queue":
          updateTtsQueue(data.payload);
          break;
      }
    };

    state.ws.onclose = () => {
      if (!state.pollTimer) {
        state.pollTimer = setInterval(loadMessages, 5000);
      }
      setTimeout(connectWs, 3000);
    };

    state.ws.onerror = () => state.ws.close();
  }

  async function loadMessages() {
    const res = await fetch("/api/messages?limit=100");
    const data = await res.json();
    for (const msg of data.messages) state.messages.set(msg.id, msg);
    if (data.featured) {
      state.featuredId = data.featured.id;
      state.featuredMessage = data.featured;
    }
    if (data.featuredHistory) state.featuredHistory = data.featuredHistory;
    renderFeed();
    renderFeaturedBar();
    renderHistory();
  }

  async function init() {
    const configRes = await fetch("/api/config");
    const config = await configRes.json();
    state.configured = config.configured;

    $("channelId").value = config.channelId || "";
    $("handle").value = config.handle || "";
    $("liveId").value = config.liveId || "";
    $("chatType").value = config.chatType || "live";

    const overlayRes = await fetch("/api/overlay-settings");
    loadOverlaySettingsUI(await overlayRes.json());

    const dashRes = await fetch("/api/dashboard-settings");
    loadDashboardSettingsUI(await dashRes.json());

    const statusRes = await fetch("/api/status");
    updateStatus(await statusRes.json());

    const sysRes = await fetch("/api/system");
    updateSystemStatus(await sysRes.json());

    const ttsQueueRes = await fetch("/api/tts/queue");
    updateTtsQueue(await ttsQueueRes.json());

    await loadMessages();
    connectWs();

    if (!state.configured) {
      showWizard();
    } else {
      showDashboard();
    }

    document.addEventListener("keydown", handleKeyboard);
  }

  // Events
  $("btn-save-config").addEventListener("click", () => saveConfig());
  $("btn-restart").addEventListener("click", async () => {
    await fetch("/api/restart", { method: "POST" });
  });
  $("btn-clear-featured").addEventListener("click", clearFeatured);
  $("btn-undo-featured").addEventListener("click", undoFeatured);
  $("btn-copy-scroll").addEventListener("click", () => copyText(`${baseUrl}/overlay/scroll`));
  $("btn-copy-featured").addEventListener("click", () => copyText(`${baseUrl}/overlay/featured`));
  $("btn-copy-tts").addEventListener("click", () => copyText(`${baseUrl}/overlay/tts`));
  $("btn-show-wizard").addEventListener("click", () => { showWizard(); wizardGoTo(1); });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      state.filter = tab.dataset.filter;
      state.selectedIndex = -1;
      renderFeed();
    });
  });

  $("search-input").addEventListener("input", (e) => {
    state.search = e.target.value;
    state.selectedIndex = -1;
    renderFeed();
  });

  ["scrollFontSize", "scrollMaxMessages", "featuredOpacity", "featuredFontSize"].forEach((id) => {
    $(id).addEventListener("input", () => {
      $(`${id}-val`).textContent = id.includes("Opacity")
        ? $(id).value
        : `${$(id).value}px`;
      saveOverlaySettings();
    });
  });

  ["scrollPosition", "scrollVertical"].forEach((id) => {
    $(id).addEventListener("change", saveOverlaySettings);
  });

  ["soundEnabled", "soundSuperchat", "soundMember"].forEach((id) => {
    $(id).addEventListener("change", saveDashboardSettings);
  });

  ["ttsEnabled", "ttsMember", "ttsSuperchat", "ttsMemberSuperchat"].forEach((id) => {
    $(id).addEventListener("change", saveDashboardSettings);
  });

  ["ttsRate", "ttsVolume"].forEach((id) => {
    $(id).addEventListener("input", () => {
      $(`${id}-val`).textContent = $(id).value;
      saveDashboardSettings();
    });
  });

  document.querySelectorAll(".tts-test-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await fetch("/api/tts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: btn.dataset.category }),
      });
    });
  });

  $("btn-clear-tts-queue").addEventListener("click", async () => {
    await fetch("/api/tts/queue", { method: "DELETE" });
  });

  $("autoFeatureKeywords").addEventListener("change", saveDashboardSettings);

  // Wizard
  $("wizard-save").addEventListener("click", async () => {
    const url = $("wizard-url").value.trim();
    if (!url) {
      $("wizard-error").textContent = "กรุณาวางลิงก์ YouTube";
      return;
    }
    const ok = await saveConfig({ youtubeUrl: url });
    if (ok) {
      state.configured = true;
      wizardGoTo(2);
      $("wizard-error").textContent = "";
    } else {
      $("wizard-error").textContent = $("status-error").textContent;
    }
  });

  $("wizard-next-2").addEventListener("click", () => wizardGoTo(3));
  $("wizard-finish").addEventListener("click", () => showDashboard());

  document.querySelectorAll(".btn-copy").forEach((btn) => {
    btn.addEventListener("click", () => {
      copyText($(btn.dataset.target).textContent);
      btn.textContent = "คัดลอกแล้ว!";
      setTimeout(() => { btn.textContent = "คัดลอก"; }, 1500);
    });
  });

  init();
})();
