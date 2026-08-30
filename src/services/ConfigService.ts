import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import type { YoutubeId } from "youtube-chat-next";
import type { AppConfig, ChatType, ConfigUpdatePayload } from "../domain/types";
import { parseYoutubeUrl } from "../domain/youtubeUrlParser";
import { getAppRoot, getDataDir } from "../appRoot";

dotenv.config({ path: path.join(getAppRoot(), ".env") });

const CONFIG_PATH = () => path.join(getDataDir(), "config.json");

interface StoredConfig {
  channelId?: string;
  liveId?: string;
  handle?: string;
  chatType?: ChatType;
}

function readStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_PATH())) {
      const raw = fs.readFileSync(CONFIG_PATH(), "utf-8");
      return JSON.parse(raw) as StoredConfig;
    }
  } catch {
    // ignore corrupt config
  }
  return {};
}

function writeStoredConfig(config: StoredConfig): void {
  const dir = path.dirname(CONFIG_PATH());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify(config, null, 2), "utf-8");
}

function envOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export class ConfigService {
  private config: AppConfig;

  constructor() {
    this.config = this.buildConfig();
  }

  private buildConfig(): AppConfig {
    const stored = readStoredConfig();
    const port = parseInt(process.env.PORT || "43123", 10);

    return {
      port: Number.isNaN(port) ? 43123 : port,
      channelId: stored.channelId ?? envOrUndefined(process.env.YOUTUBE_CHANNEL_ID),
      liveId: stored.liveId ?? envOrUndefined(process.env.YOUTUBE_LIVE_ID),
      handle: stored.handle ?? envOrUndefined(process.env.YOUTUBE_HANDLE),
      chatType: stored.chatType ?? (process.env.YOUTUBE_CHAT_TYPE === "top" ? "top" : "live"),
    };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  validateConfig(config: Partial<AppConfig>): void {
    const merged = { ...this.config, ...config };
    if (!merged.channelId && !merged.liveId && !merged.handle) {
      throw new Error("ต้องระบุ channelId, liveId หรือ handle อย่างน้อย 1 ค่า");
    }
  }

  isConfigured(): boolean {
    const { channelId, liveId, handle } = this.config;
    return !!(channelId || liveId || handle);
  }

  updateConfig(payload: ConfigUpdatePayload): AppConfig {
    const stored = readStoredConfig();

    if (payload.youtubeUrl) {
      const parsed = parseYoutubeUrl(payload.youtubeUrl);
      if (parsed.liveId) stored.liveId = parsed.liveId;
      if (parsed.channelId) stored.channelId = parsed.channelId;
      if (parsed.handle) stored.handle = parsed.handle;
    }

    if (payload.channelId !== undefined) {
      stored.channelId = payload.channelId.trim() || undefined;
    }
    if (payload.liveId !== undefined) {
      stored.liveId = payload.liveId.trim() || undefined;
    }
    if (payload.handle !== undefined) {
      stored.handle = payload.handle.trim() || undefined;
    }
    if (payload.chatType !== undefined) {
      stored.chatType = payload.chatType;
    }

    writeStoredConfig(stored);
    this.config = this.buildConfig();
    this.validateConfig(this.config);
    return this.getConfig();
  }

  getLiveChatOptions(): YoutubeId | null {
    const { channelId, liveId, handle } = this.config;
    if (liveId) return { liveId };
    if (handle) return { handle };
    if (channelId) return { channelId };
    return null;
  }
}
