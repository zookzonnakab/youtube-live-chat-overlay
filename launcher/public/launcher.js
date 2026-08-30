async function poll() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    render(data);
  } catch {
    // retry
  }
}

function render(data) {
  const box = document.getElementById("status-box");
  const icon = document.getElementById("status-icon");
  const text = document.getElementById("status-text");
  const versionInfo = document.getElementById("version-info");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const btnUpdate = document.getElementById("btn-update");
  const hint = document.getElementById("hint");
  const progressBar = document.getElementById("progress-bar");
  const progressFill = document.getElementById("progress-fill");

  box.className = "status-box " + (data.state || "checking");
  versionInfo.textContent = `ติดตั้ง: v${data.currentVersion}` +
    (data.latestVersion ? ` · ล่าสุด: v${data.latestVersion}` : "");

  if (data.updating) {
    icon.textContent = "⬇️";
    text.textContent = data.updateMessage || "กำลังอัปเดต...";
    progressBar.classList.remove("hidden");
    progressFill.style.width = (data.updateProgress || 0) + "%";
    btnStart.disabled = true;
    btnUpdate.classList.add("hidden");
    hint.textContent = "กรุณารอจนอัปเดตเสร็จ";
    return;
  }

  progressBar.classList.add("hidden");

  if (data.serverRunning) {
    icon.textContent = "🟢";
    text.textContent = "โปรแกรมกำลังทำงาน";
    btnStart.classList.add("hidden");
    btnStop.classList.remove("hidden");
    btnUpdate.classList.add("hidden");
    hint.textContent = "Dashboard: http://localhost:43123/dock";
    return;
  }

  btnStop.classList.add("hidden");
  btnStart.classList.remove("hidden");

  if (data.upToDate) {
    icon.textContent = "✅";
    text.textContent = "พร้อมใช้งาน — เวอร์ชันล่าสุดแล้ว";
    btnStart.disabled = false;
    btnUpdate.classList.add("hidden");
    hint.textContent = "กดเริ่มโปรแกรมเพื่อเปิด Dashboard";
  } else if (data.updateAvailable) {
    icon.textContent = "🔄";
    text.textContent = `มีเวอร์ชันใหม่ v${data.latestVersion}`;
    btnStart.disabled = true;
    btnUpdate.classList.remove("hidden");
    hint.textContent = "ต้องอัปเดตก่อนจึงจะเริ่มได้";
  } else if (data.error) {
    icon.textContent = "⚠️";
    text.textContent = data.error;
    btnStart.disabled = !data.offlineMode;
    btnUpdate.classList.add("hidden");
    hint.textContent = data.offlineMode
      ? "ไม่สามารถเช็คอัปเดต — เริ่มด้วยเวอร์ชันปัจจุบันได้"
      : "ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
  } else {
    icon.textContent = "⏳";
    text.textContent = "กำลังตรวจสอบ...";
    btnStart.disabled = true;
  }
}

document.getElementById("btn-start").addEventListener("click", async () => {
  const btn = document.getElementById("btn-start");
  btn.disabled = true;
  await fetch("/api/start", { method: "POST" });
  poll();
});

document.getElementById("btn-stop").addEventListener("click", async () => {
  await fetch("/api/stop", { method: "POST" });
  poll();
});

document.getElementById("btn-update").addEventListener("click", async () => {
  const btn = document.getElementById("btn-update");
  btn.disabled = true;
  await fetch("/api/update", { method: "POST" });
  poll();
});

poll();
setInterval(poll, 1500);
