import type { WebSocket } from "ws";
import type { SystemStatus, WsEvent } from "../domain/types";

export type ClientType = "dock" | "scroll" | "featured" | "tts" | "unknown";

interface TrackedClient {
  ws: WebSocket;
  type: ClientType;
  lastPing: number;
}

type ClientMessageHandler = (msg: { type?: string; [key: string]: unknown }) => void;

export class BroadcastService {
  private clients = new Map<WebSocket, TrackedClient>();
  private messageHandlers: ClientMessageHandler[] = [];

  onClientMessage(handler: ClientMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  addClient(ws: WebSocket, type: ClientType = "unknown"): void {
    this.clients.set(ws, { ws, type, lastPing: Date.now() });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          type?: string;
          clientType?: ClientType;
        };
        const client = this.clients.get(ws);
        if (!client) return;

        if (msg.type === "client:register" && msg.clientType) {
          client.type = msg.clientType;
        }
        if (msg.type === "client:ping") {
          client.lastPing = Date.now();
        }

        for (const handler of this.messageHandlers) {
          handler(msg);
        }
      } catch {
        // ignore
      }
    });

    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));
  }

  broadcast(event: WsEvent): void {
    const data = JSON.stringify(event);
    for (const { ws } of this.clients.values()) {
      if (ws.readyState === 1) {
        ws.send(data);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getSystemStatus(chatIngestRunning: boolean, chatLive: boolean): SystemStatus {
    let scrollOverlayConnected = false;
    let featuredOverlayConnected = false;
    let ttsOverlayConnected = false;

    const now = Date.now();
    for (const client of this.clients.values()) {
      if (now - client.lastPing > 30000) continue;
      if (client.type === "scroll") scrollOverlayConnected = true;
      if (client.type === "featured") featuredOverlayConnected = true;
      if (client.type === "tts") ttsOverlayConnected = true;
    }

    return {
      wsConnected: this.clients.size,
      scrollOverlayConnected,
      featuredOverlayConnected,
      ttsOverlayConnected,
      chatIngestRunning,
      chatLive,
    };
  }

  broadcastSystemStatus(chatIngestRunning: boolean, chatLive: boolean): void {
    this.broadcast({
      type: "system:status",
      payload: this.getSystemStatus(chatIngestRunning, chatLive),
    });
  }
}
