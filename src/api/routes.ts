import { Router, type Request, type Response } from "express";
import { parseYoutubeUrl } from "../domain/youtubeUrlParser";
import type { ConfigUpdatePayload, OverlaySettings, TtsCategory } from "../domain/types";
import type { BroadcastService } from "../services/BroadcastService";
import type { ChatIngestService } from "../services/ChatIngestService";
import type { ConfigService } from "../services/ConfigService";
import type { FeaturedService } from "../services/FeaturedService";
import type { SettingsService } from "../services/SettingsService";
import type { TtsQueueService } from "../services/TtsQueueService";

export function createApiRouter(
  configService: ConfigService,
  chatIngestService: ChatIngestService,
  featuredService: FeaturedService,
  settingsService: SettingsService,
  broadcastService: BroadcastService,
  ttsQueueService: TtsQueueService,
  onConfigUpdate: () => Promise<void>
): Router {
  const router = Router();

  router.get("/status", (_req: Request, res: Response) => {
    res.json(chatIngestService.getStatus());
  });

  router.get("/system", (_req: Request, res: Response) => {
    const status = chatIngestService.getStatus();
    res.json(
      broadcastService.getSystemStatus(status.running, status.live)
    );
  });

  router.get("/messages", (req: Request, res: Response) => {
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 100);
    res.json({
      messages: chatIngestService.getRecentMessages(limit),
      featured: featuredService.getFeatured(),
      featuredHistory: featuredService.getHistory(),
    });
  });

  router.get("/config", (_req: Request, res: Response) => {
    res.json({
      ...configService.getConfig(),
      configured: configService.isConfigured(),
    });
  });

  router.post("/parse-url", (req: Request, res: Response) => {
    const { url } = req.body as { url?: string };
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }
    res.json(parseYoutubeUrl(url));
  });

  router.put("/config", async (req: Request, res: Response) => {
    try {
      const payload = req.body as ConfigUpdatePayload;
      configService.updateConfig(payload);
      await onConfigUpdate();
      res.json({
        ...configService.getConfig(),
        configured: configService.isConfigured(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  router.post("/restart", async (_req: Request, res: Response) => {
    await chatIngestService.restart();
    res.json(chatIngestService.getStatus());
  });

  router.get("/overlay-settings", (_req: Request, res: Response) => {
    res.json(settingsService.getOverlaySettings());
  });

  router.put("/overlay-settings", (req: Request, res: Response) => {
    const settings = settingsService.updateOverlaySettings(
      req.body as Partial<OverlaySettings>
    );
    broadcastService.broadcast({ type: "overlay:settings", payload: settings });
    res.json(settings);
  });

  router.get("/dashboard-settings", (_req: Request, res: Response) => {
    res.json(settingsService.getDashboardSettings());
  });

  router.put("/dashboard-settings", (req: Request, res: Response) => {
    const settings = settingsService.updateDashboardSettings(req.body);
    broadcastService.broadcast({ type: "dashboard:settings", payload: settings });
    res.json(settings);
  });

  router.post("/featured", (req: Request, res: Response) => {
    const { messageId } = req.body as { messageId?: string };
    if (!messageId) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }

    const message = chatIngestService.findMessageById(messageId);
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    featuredService.setFeatured(message);
    broadcastService.broadcast({
      type: "featured:update",
      payload: { message },
    });
    broadcastService.broadcast({
      type: "featured:history",
      payload: { history: featuredService.getHistory() },
    });
    res.json({ message });
  });

  router.delete("/featured", (_req: Request, res: Response) => {
    featuredService.clearFeatured();
    broadcastService.broadcast({
      type: "featured:update",
      payload: { message: null },
    });
    res.json({ ok: true });
  });

  router.post("/featured/undo", (_req: Request, res: Response) => {
    const message = featuredService.undoFeatured();
    broadcastService.broadcast({
      type: "featured:update",
      payload: { message },
    });
    broadcastService.broadcast({
      type: "featured:history",
      payload: { history: featuredService.getHistory() },
    });
    res.json({ message });
  });

  router.get("/featured/history", (_req: Request, res: Response) => {
    res.json({ history: featuredService.getHistory() });
  });

  router.get("/tts/queue", (_req: Request, res: Response) => {
    res.json(ttsQueueService.getStatus());
  });

  router.post("/tts/test", (req: Request, res: Response) => {
    const { category } = req.body as { category?: TtsCategory };
    ttsQueueService.enqueueTest(category || "member");
    res.json({ ok: true });
  });

  router.delete("/tts/queue", (_req: Request, res: Response) => {
    ttsQueueService.clearQueue();
    res.json({ ok: true });
  });

  return router;
}
