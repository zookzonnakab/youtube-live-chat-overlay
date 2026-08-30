import path from "path";

export function getAppRoot(): string {
  return process.env.APP_ROOT || process.cwd();
}

export function getDataDir(): string {
  return path.join(getAppRoot(), "data");
}
