import express from "express";
import http from "http";
import path from "path";
import { createApiRouter } from "./api/routes";
import { BroadcastService } from "./services/BroadcastService";
import { ChatIngestService } from "./services/ChatIngestService";
import { ConfigService } from "./services/ConfigService";
import { FeaturedService } from "./services/FeaturedService";
import { SettingsService } from "./services/SettingsService";
import { TtsQueueService } from "./services/TtsQueueService";
import { WebSocketHub } from "./ws/WebSocketHub";
import { getAppRoot } from "./appRoot";

export interface AppContext {
  configService: ConfigService;
  chatIngestService: ChatIngestService;
  featuredService: FeaturedService;
  settingsService: SettingsService;
  ttsQueueService: TtsQueueService;
  broadcastService: BroadcastService;
  wsHub: WebSocketHub;
  server: http.Server;
}

export async function createApp(): Promise<AppContext> {
  const configService = new ConfigService();
  const broadcastService = new BroadcastService();
  const featuredService = new FeaturedService();
  const settingsService = new SettingsService();
  const ttsQueueService = new TtsQueueService(broadcastService, settingsService);
  const chatIngestService = new ChatIngestService(
    configService,
    broadcastService,
    featuredService,
    settingsService,
    ttsQueueService
  );

  const app = express();
  app.use(express.json());

  const publicDir = path.join(getAppRoot(), "public");
  app.use(express.static(publicDir));

  const onConfigUpdate = async () => {
    await chatIngestService.restart();
  };

  app.use(
    "/api",
    createApiRouter(
      configService,
      chatIngestService,
      featuredService,
      settingsService,
      broadcastService,
      ttsQueueService,
      onConfigUpdate
    )
  );

  app.get("/overlay/scroll", (_req, res) => {
    res.sendFile(path.join(publicDir, "overlay", "scroll.html"));
  });

  app.get("/overlay/featured", (_req, res) => {
    res.sendFile(path.join(publicDir, "overlay", "featured.html"));
  });

  app.get("/overlay/tts", (_req, res) => {
    res.sendFile(path.join(publicDir, "overlay", "tts.html"));
  });

  app.get("/dock", (_req, res) => {
    res.sendFile(path.join(publicDir, "dock", "index.html"));
  });

  const server = http.createServer(app);
  const wsHub = new WebSocketHub(
    server,
    broadcastService,
    chatIngestService,
    featuredService,
    settingsService,
    ttsQueueService
  );

  return {
    configService,
    chatIngestService,
    featuredService,
    settingsService,
    ttsQueueService,
    broadcastService,
    wsHub,
    server,
  };
}
