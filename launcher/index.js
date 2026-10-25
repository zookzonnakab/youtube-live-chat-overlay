#!/usr/bin/env node
"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { URL } = require("url");

const LAUNCHER_PORT = 43124;
const APP_PORT = 43123;

const state = {
  currentVersion: "0.0.0",
  latestVersion: null,
  upToDate: false,
  updateAvailable: false,
  updating: false,
  updateProgress: 0,
  updateMessage: "",
  serverRunning: false,
  error: null,
  offlineMode: false,
  githubRepo: "",
};

let serverProcess = null;
let paths = null;

function getUserDataDir() {
  const base =
    process.env.LOCALAPPDATA ||
    path.join(process.env.USERPROFILE || "", "AppData", "Local");
  const dir = path.join(base, "YouTubeLiveChatOverlay");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isWritableDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function getPaths() {
  if (paths) return paths;

  const installRoot = process.pkg
    ? path.dirname(process.execPath)
    : path.resolve(__dirname, "..");

  const appDir = process.pkg
    ? path.join(installRoot, "app")
    : installRoot;
  const nodePortable = path.join(installRoot, "node", "node.exe");
  const nodeExe = process.pkg && fs.existsSync(nodePortable) ? nodePortable : process.execPath;
  const serverEntry = path.join(appDir, "dist", "index.js");
  const versionFile = path.join(appDir, "version.json");
  const publicDir = path.join(__dirname, "public");
  const userDataDir = getUserDataDir();
  const pidFile = path.join(userDataDir, ".server.pid");
  const serverLog = path.join(userDataDir, "server.log");

  paths = {
    installRoot,
    appDir,
    nodeExe,
    serverEntry,
    versionFile,
    publicDir,
    userDataDir,
    pidFile,
    serverLog,
    installWritable: isWritableDir(installRoot),
  };

  return paths;
}

function readVersionInfo() {
  const p = getPaths();
  try {
    const info = JSON.parse(fs.readFileSync(p.versionFile, "utf-8"));
    state.currentVersion = info.version || "0.0.0";
    state.githubRepo = info.githubRepo || "";
    return info;
  } catch {
    state.currentVersion = "0.0.0";
    return { version: "0.0.0", githubRepo: "" };
  }
}

function writeVersionInfo(version) {
  const p = getPaths();
  const info = readVersionInfo();
  info.version = version;
  fs.mkdirSync(path.dirname(p.versionFile), { recursive: true });
  fs.writeFileSync(p.versionFile, JSON.stringify(info, null, 2));
  state.currentVersion = version;
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { "User-Agent": "YouTubeLiveChat-Launcher" } },
      (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          httpsGet(res.headers.location).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

function httpsDownload(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { "User-Agent": "YouTubeLiveChat-Launcher" } }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        httpsDownload(res.headers.location, dest, onProgress).then(resolve).catch(reject);
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        if (total > 0 && onProgress) {
          onProgress(Math.round((downloaded / total) * 100));
        }
      });
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function checkForUpdates() {
  state.error = null;
  readVersionInfo();

  if (!state.githubRepo || state.githubRepo.includes("YOUR_USERNAME")) {
    state.upToDate = true;
    state.updateAvailable = false;
    state.offlineMode = true;
    state.error = "ยังไม่ได้ตั้งค่า githubRepo ใน version.json";
    return;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${state.githubRepo}/releases/latest`;
    const buf = await httpsGet(apiUrl);
    const release = JSON.parse(buf.toString());
    const tag = (release.tag_name || "").replace(/^v/, "");
    state.latestVersion = tag;

    if (compareVersions(state.currentVersion, tag) < 0) {
      state.updateAvailable = true;
      state.upToDate = false;
    } else {
      state.updateAvailable = false;
      state.upToDate = true;
    }
  } catch (err) {
    state.offlineMode = true;
    state.upToDate = true;
    state.updateAvailable = false;
    state.error = `เช็คอัปเดตไม่ได้: ${err.message}`;
  }
}

function findAppAsset(release) {
  const version = (release.tag_name || "").replace(/^v/, "");
  const patterns = [
    `app-v${version}.zip`,
    `YouTubeLiveChat-app-v${version}.zip`,
    `app-${version}.zip`,
  ];
  for (const asset of release.assets || []) {
    if (patterns.some((p) => asset.name === p)) {
      return asset;
    }
  }
  return (release.assets || []).find((a) => a.name.endsWith(".zip") && a.name.includes("app"));
}

async function performUpdate() {
  if (state.updating) return;
  state.updating = true;
  state.updateProgress = 0;
  state.updateMessage = "กำลังดาวน์โหลดอัปเดต...";

  try {
    const p = getPaths();
    if (!p.installWritable) {
      throw new Error(
        "โฟลเดอร์ติดตั้งเขียนไม่ได้ (มักติดตั้งใน Program Files) — ถอนการติดตั้งแล้วติดตั้งเวอร์ชันใหม่จาก GitHub Releases"
      );
    }

    const apiUrl = `https://api.github.com/repos/${state.githubRepo}/releases/latest`;
    const buf = await httpsGet(apiUrl);
    const release = JSON.parse(buf.toString());
    const asset = findAppAsset(release);

    if (!asset) {
      throw new Error("ไม่พบไฟล์อัปเดตใน GitHub Release");
    }

    const zipPath = path.join(p.userDataDir, "update-temp.zip");
    const extractDir = path.join(p.userDataDir, "update-temp");

    await stopServer();
    await httpsDownload(asset.browser_download_url, zipPath, (pct) => {
      state.updateProgress = pct;
      state.updateMessage = `กำลังดาวน์โหลด... ${pct}%`;
    });

    state.updateMessage = "กำลังติดตั้งอัปเดต...";
    state.updateProgress = 95;

    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    fs.mkdirSync(extractDir, { recursive: true });

    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"`,
      { stdio: "pipe" }
    );

    const extractedApp = fs.existsSync(path.join(extractDir, "app"))
      ? path.join(extractDir, "app")
      : extractDir;

    copyDirSync(extractedApp, p.appDir);

    const newVersion = (release.tag_name || "").replace(/^v/, "");
    writeVersionInfo(newVersion);

    fs.unlinkSync(zipPath);
    fs.rmSync(extractDir, { recursive: true, force: true });

    state.updateMessage = "อัปเดตเสร็จแล้ว!";
    state.updateProgress = 100;
    state.upToDate = true;
    state.updateAvailable = false;
    state.latestVersion = newVersion;
  } catch (err) {
    state.error = `อัปเดตล้มเหลว: ${err.message}`;
  } finally {
    state.updating = false;
    await checkForUpdates();
  }
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function isServerRunning() {
  const p = getPaths();
  try {
    if (fs.existsSync(p.pidFile)) {
      const pid = parseInt(fs.readFileSync(p.pidFile, "utf-8"), 10);
      process.kill(pid, 0);
      return true;
    }
  } catch {
    // not running
  }
  return serverProcess !== null && !serverProcess.killed;
}

async function stopServer() {
  const p = getPaths();
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
  try {
    if (fs.existsSync(p.pidFile)) {
      const pid = parseInt(fs.readFileSync(p.pidFile, "utf-8"), 10);
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: "pipe" });
      fs.unlinkSync(p.pidFile);
    }
  } catch {
    // ignore
  }
  state.serverRunning = false;
}

async function startServer() {
  if (!state.upToDate && state.updateAvailable) {
    state.error = "ต้องอัปเดตก่อนจึงจะเริ่มได้";
    return;
  }
  if (isServerRunning()) {
    state.serverRunning = true;
    openBrowser(`http://localhost:${APP_PORT}/dock`);
    return;
  }

  const p = getPaths();
  if (!fs.existsSync(p.serverEntry)) {
    state.error = "ไม่พบไฟล์โปรแกรม — ลองติดตั้งใหม่";
    return;
  }
  if (!fs.existsSync(p.nodeExe)) {
    state.error = "ไม่พบ Node.js runtime — ลองติดตั้งใหม่";
    return;
  }

  try {
    fs.writeFileSync(p.serverLog, `--- start ${new Date().toISOString()} ---\n`);
  } catch {
    // ignore log write failure
  }

  const logFd = (() => {
    try {
      return fs.openSync(p.serverLog, "a");
    } catch {
      return "ignore";
    }
  })();

  serverProcess = spawn(p.nodeExe, [p.serverEntry], {
    cwd: p.appDir,
    env: {
      ...process.env,
      APP_ROOT: p.appDir,
      DATA_DIR: path.join(p.userDataDir, "data"),
      PORT: String(APP_PORT),
    },
    detached: false,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });

  fs.mkdirSync(path.dirname(p.pidFile), { recursive: true });
  fs.writeFileSync(p.pidFile, String(serverProcess.pid));

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    state.serverRunning = false;
    if (code && code !== 0) {
      state.error = `เซิร์ฟเวอร์ปิดตัวเอง (code ${code}) — ดู log ที่ ${p.serverLog}`;
    }
    try {
      fs.unlinkSync(p.pidFile);
    } catch {
      // ignore
    }
  });

  state.serverRunning = true;
  state.error = null;
  await sleep(1500);

  if (!isServerRunning()) {
    state.error = `เซิร์ฟเวอร์สตาร์ทไม่สำเร็จ — ดู log ที่ ${p.serverLog}`;
    state.serverRunning = false;
    return;
  }

  openBrowser(`http://localhost:${APP_PORT}/dock`);
}

function openBrowser(url) {
  try {
    // detached start is more reliable than execSync when reopening from a second instance
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {
    try {
      execSync(`start "" "${url}"`, { stdio: "ignore", shell: true });
    } catch {
      // ignore
    }
  }
}

function reopenExistingInstance() {
  openBrowser(`http://localhost:${LAUNCHER_PORT}`);
  // If the app server is already running, reopen the dashboard too
  if (isServerRunning()) {
    openBrowser(`http://localhost:${APP_PORT}/dock`);
  } else {
    // pid file may be stale; still try dock — browser will show error page if down
    // Prefer probing the port quickly via a no-op spawn delay
    setTimeout(() => {
      try {
        const req = http.get(`http://127.0.0.1:${APP_PORT}/api/status`, () => {
          openBrowser(`http://localhost:${APP_PORT}/dock`);
        });
        req.on("error", () => {});
        req.setTimeout(800, () => req.destroy());
      } catch {
        // ignore
      }
    }, 200);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getState() {
  state.serverRunning = isServerRunning();
  return {
    ...state,
    state: state.serverRunning
      ? "running"
      : state.updating
        ? "updating"
        : state.upToDate
          ? "up-to-date"
          : state.updateAvailable
            ? "outdated"
            : state.error
              ? "error"
              : "checking",
  };
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
  };
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
    res.end(data);
  });
}

function startLauncherServer() {
  const p = getPaths();

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${LAUNCHER_PORT}`);

    res.setHeader("Access-Control-Allow-Origin", "*");

    if (url.pathname === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(getState()));
      return;
    }

    if (url.pathname === "/api/update" && req.method === "POST") {
      performUpdate().catch(() => {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === "/api/start" && req.method === "POST") {
      await startServer();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === "/api/stop" && req.method === "POST") {
      await stopServer();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === "/api/open-dashboard" && req.method === "POST") {
      openBrowser(`http://localhost:${APP_PORT}/dock`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === "/api/open-launcher" && req.method === "POST") {
      openBrowser(`http://localhost:${LAUNCHER_PORT}`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    let filePath = path.join(p.publicDir, url.pathname === "/" ? "index.html" : url.pathname);
    if (!filePath.startsWith(p.publicDir)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    serveStatic(filePath, res);
  });

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      // Already running: reopen browser windows instead of failing silently
      reopenExistingInstance();
      setTimeout(() => process.exit(0), 600);
      return;
    }
    console.error(err);
    process.exit(1);
  });

  server.listen(LAUNCHER_PORT, () => {
    openBrowser(`http://localhost:${LAUNCHER_PORT}`);
  });
}

async function main() {
  readVersionInfo();
  await checkForUpdates();
  startLauncherServer();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
