import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "http";
import type { BroadcastService } from "../services/BroadcastService";
import type { ChatIngestService } from "../services/ChatIngestService";
import type { FeaturedService } from "../services/FeaturedService";
import type { TtsQueueService } from "../services/TtsQueueService";
import type { SettingsService } from "../services/SettingsService";

export class WebSocketHub {
  private wss: WebSocketServer;
  private systemStatusTimer: ReturnType<typeof setInterval>;

  constructor(
    server: Server,
    private readonly broadcastService: BroadcastService,
    private readonly chatIngestService: ChatIngestService,
    private readonly featuredService: FeaturedService,
    private readonly settingsService: SettingsService,
    private readonly ttsQueueService: TtsQueueService
  ) {
    this.wss = new WebSocketServer({ server, path: "/ws" });
    this.wss.on("connection", (ws) => this.handleConnection(ws));

    this.systemStatusTimer = setInterval(() => {
      const status = this.chatIngestService.getStatus();
      this.broadcastService.broadcastSystemStatus(status.running, status.live);
    }, 5000);
  }

  private handleConnection(ws: WebSocket): void {
    this.broadcastService.addClient(ws);

    const status = this.chatIngestService.getStatus();

    ws.send(
      JSON.stringify({
        type: "chat:history",
        payload: {
          messages: this.chatIngestService.getRecentMessages(50),
          featured: this.featuredService.getFeatured(),
          overlaySettings: this.settingsService.getOverlaySettings(),
          dashboardSettings: this.settingsService.getDashboardSettings(),
          featuredHistory: this.featuredService.getHistory(),
        },
      })
    );

    ws.send(
      JSON.stringify({
        type: "status:update",
        payload: status,
      })
    );

    ws.send(
      JSON.stringify({
        type: "overlay:settings",
        payload: this.settingsService.getOverlaySettings(),
      })
    );

    ws.send(
      JSON.stringify({
        type: "system:status",
        payload: this.broadcastService.getSystemStatus(status.running, status.live),
      })
    );

    ws.send(
      JSON.stringify({
        type: "tts:queue",
        payload: this.ttsQueueService.getStatus(),
      })
    );
  }

  close(): void {
    clearInterval(this.systemStatusTimer);
    this.wss.close();
  }
}
