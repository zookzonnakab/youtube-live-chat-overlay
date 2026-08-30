import {
  LiveChat,
  NotLiveError,
  RateLimitError,
  ScrapeError,
} from "youtube-chat-next";
import { normalizeChatItem } from "../domain/messageNormalizer";
import type { ChatStatus, NormalizedMessage } from "../domain/types";
import type { BroadcastService } from "./BroadcastService";
import type { ConfigService } from "./ConfigService";
import type { FeaturedService } from "./FeaturedService";
import type { SettingsService } from "./SettingsService";
import type { TtsQueueService } from "./TtsQueueService";

const MAX_MESSAGES = 100;
const MAX_RETRY_ATTEMPTS = 5;

export class ChatIngestService {
  private liveChat: LiveChat | null = null;
  private messages: NormalizedMessage[] = [];
  private status: ChatStatus = {
    live: false,
    messageCount: 0,
    running: false,
  };
  private retryAttempts = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly broadcastService: BroadcastService,
    private readonly featuredService: FeaturedService,
    private readonly settingsService: SettingsService,
    private readonly ttsQueueService: TtsQueueService
  ) {}

  getStatus(): ChatStatus {
    return { ...this.status };
  }

  getRecentMessages(limit = 50): NormalizedMessage[] {
    return this.messages.slice(-limit);
  }

  findMessageById(id: string): NormalizedMessage | undefined {
    return this.messages.find((m) => m.id === id);
  }

  private updateStatus(partial: Partial<ChatStatus>): void {
    this.status = { ...this.status, ...partial };
    this.broadcastService.broadcast({
      type: "status:update",
      payload: this.getStatus(),
    });
    this.broadcastService.broadcastSystemStatus(this.status.running, this.status.live);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleRetry(reason: string, delayMs: number): void {
    if (this.stopping) return;
    this.retryAttempts += 1;
    if (this.retryAttempts > MAX_RETRY_ATTEMPTS) {
      this.updateStatus({
        live: false,
        running: false,
        error: `หยุด retry หลัง ${MAX_RETRY_ATTEMPTS} ครั้ง: ${reason}`,
      });
      return;
    }

    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      void this.start();
    }, delayMs);
  }

  private handleNewMessage(message: NormalizedMessage): void {
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages = this.messages.slice(-MAX_MESSAGES);
    }
    this.updateStatus({ messageCount: this.messages.length });
    this.broadcastService.broadcast({
      type: "chat:new",
      payload: { message },
    });

    const dash = this.settingsService.getDashboardSettings();

    if (message.superchat && dash.soundEnabled && dash.soundSuperchat) {
      this.broadcastService.broadcast({
        type: "notification",
        payload: { kind: "superchat", message },
      });
    } else if (message.author.isMember && dash.soundEnabled && dash.soundMember) {
      this.broadcastService.broadcast({
        type: "notification",
        payload: { kind: "member", message },
      });
    }

    if (this.settingsService.shouldAutoFeature(message.text)) {
      this.featuredService.setFeatured(message);
      this.broadcastService.broadcast({
        type: "featured:update",
        payload: { message },
      });
      this.broadcastService.broadcast({
        type: "featured:history",
        payload: { history: this.featuredService.getHistory() },
      });
      this.broadcastService.broadcast({
        type: "notification",
        payload: { kind: "auto-feature", message },
      });
    }

    this.ttsQueueService.tryEnqueue(message);
  }

  private attachListeners(chat: LiveChat): void {
    chat.on("start", (liveId: string) => {
      this.retryAttempts = 0;
      this.updateStatus({
        live: true,
        liveId,
        running: true,
        error: undefined,
      });
    });

    chat.on("chat", (item) => {
      this.handleNewMessage(normalizeChatItem(item));
    });

    chat.on("end", (reason?: string) => {
      this.updateStatus({
        live: false,
        running: false,
        error: reason,
      });
    });

    chat.on("error", (err: unknown) => {
      if (err instanceof RateLimitError) {
        const delay = 15000 + Math.random() * 10000;
        this.updateStatus({
          live: false,
          running: false,
          error: "Rate limited — กำลัง retry...",
        });
        this.scheduleRetry(err.message, delay);
        return;
      }

      if (err instanceof NotLiveError) {
        this.updateStatus({
          live: false,
          running: false,
          error: "ช่องไม่ได้ไลฟ์อยู่",
        });
        return;
      }

      if (err instanceof ScrapeError) {
        this.updateStatus({
          live: false,
          running: false,
          error: "YouTube เปลี่ยนโครงสร้าง — ต้องอัปเดต library",
        });
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      this.updateStatus({
        live: false,
        running: false,
        error: message,
      });
    });
  }

  async start(): Promise<boolean> {
    this.stopping = false;
    this.clearRetryTimer();
    await this.stop();

    const config = this.configService.getConfig();
    const options = this.configService.getLiveChatOptions();

    if (!options) {
      this.updateStatus({
        live: false,
        running: false,
        error: "ยังไม่ได้ตั้งค่า channelId, liveId หรือ handle",
      });
      return false;
    }

    const chat = new LiveChat(options, 1000, config.chatType);
    this.attachListeners(chat);
    this.liveChat = chat;

    try {
      const ok = await chat.start();
      if (!ok) {
        this.updateStatus({
          live: false,
          running: false,
          error: "ไม่สามารถเริ่มดึงแชทได้",
        });
      } else {
        this.updateStatus({ running: true });
      }
      return ok;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.updateStatus({
        live: false,
        running: false,
        error: message,
      });
      return false;
    }
  }

  async stop(): Promise<void> {
    this.clearRetryTimer();
    if (this.liveChat) {
      this.liveChat.stop("Stopped by service");
      this.liveChat.removeAllListeners();
      this.liveChat = null;
    }
    this.updateStatus({ running: false });
  }

  async restart(): Promise<boolean> {
    return this.start();
  }

  async shutdown(): Promise<void> {
    this.stopping = true;
    await this.stop();
  }
}
