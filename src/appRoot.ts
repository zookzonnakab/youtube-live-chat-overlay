import fs from "fs";
import path from "path";

export function getAppRoot(): string {
  return process.env.APP_ROOT || process.cwd();
}

/**
 * Writable data directory.
 * Installed Windows builds (APP_ROOT set by launcher) use LocalAppData
 * so config/settings work without admin rights under Program Files.
 * Local `npm run dev` keeps using ./data next to the project.
 */
export function getDataDir(): string {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }

  if (process.env.APP_ROOT && process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA ||
      path.join(process.env.USERPROFILE || "", "AppData", "Local");
    const dir = path.join(base, "YouTubeLiveChatOverlay", "data");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  return path.join(getAppRoot(), "data");
}
