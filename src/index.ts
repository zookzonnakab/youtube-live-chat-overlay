import { createApp } from "./server";

async function main(): Promise<void> {
  const ctx = await createApp();
  const port = ctx.configService.getConfig().port;

  ctx.server.listen(port, () => {
    console.log(`Keybaht Live Chat running on http://localhost:${port}`);
    console.log(`  Scroll overlay:  http://localhost:${port}/overlay/scroll`);
    console.log(`  Featured overlay: http://localhost:${port}/overlay/featured`);
    console.log(`  Control dock:     http://localhost:${port}/dock`);
  });

  void ctx.chatIngestService.start();

  const shutdown = async () => {
    console.log("Shutting down...");
    await ctx.chatIngestService.shutdown();
    ctx.wsHub.close();
    ctx.server.close(() => process.exit(0));
  };

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
