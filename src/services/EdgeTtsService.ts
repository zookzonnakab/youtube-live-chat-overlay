import fs from "fs";
import https from "https";
import path from "path";
import { EdgeTTS } from "node-edge-tts";
import { getDataDir } from "../appRoot";

const DEFAULT_VOICE = "th-TH-PremwadeeNeural";
const MAX_CACHE_FILES = 40;
const MAX_GOOGLE_CHUNK = 180;

export class EdgeTtsService {
  private readonly cacheDir: string;

  constructor() {
    this.cacheDir = path.join(getDataDir(), "tts-cache");
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  getCacheDir(): string {
    return this.cacheDir;
  }

  private safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  }

  private rateToEdge(rate: number): string {
    const pct = Math.round((rate - 1) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}%`;
  }

  getFilePath(id: string): string {
    return path.join(this.cacheDir, `${this.safeId(id)}.mp3`);
  }

  async synthesize(id: string, text: string, rate = 1): Promise<string> {
    const filePath = this.getFilePath(id);

    try {
      await this.synthesizeEdge(text, rate, filePath);
    } catch (err) {
      console.warn("Edge TTS unavailable, using Google TTS fallback:", (err as Error).message);
      await this.synthesizeGoogle(text, filePath);
    }

    this.pruneCache();
    return filePath;
  }

  private async synthesizeEdge(text: string, rate: number, filePath: string): Promise<void> {
    const tts = new EdgeTTS({
      voice: DEFAULT_VOICE,
      lang: "th-TH",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      rate: this.rateToEdge(rate),
      timeout: 25000,
    });
    await tts.ttsPromise(text, filePath);
  }

  /** Unofficial Google Translate TTS — works on older Node where Edge WS fails */
  private async synthesizeGoogle(text: string, filePath: string): Promise<void> {
    const chunks = this.chunkText(text, MAX_GOOGLE_CHUNK);
    const parts: Buffer[] = [];
    for (const chunk of chunks) {
      parts.push(await this.fetchGoogleChunk(chunk));
    }
    fs.writeFileSync(filePath, Buffer.concat(parts));
  }

  private chunkText(text: string, maxLen: number): string[] {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (cleaned.length <= maxLen) return [cleaned];

    const parts: string[] = [];
    let rest = cleaned;
    while (rest.length > maxLen) {
      let splitAt = rest.lastIndexOf(" ", maxLen);
      if (splitAt < maxLen * 0.4) splitAt = maxLen;
      parts.push(rest.slice(0, splitAt).trim());
      rest = rest.slice(splitAt).trim();
    }
    if (rest) parts.push(rest);
    return parts;
  }

  private fetchGoogleChunk(text: string): Promise<Buffer> {
    const url =
      "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=" +
      encodeURIComponent(text);

    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "th-TH,th;q=0.9",
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Google TTS HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        }
      );
      req.on("error", reject);
      req.setTimeout(20000, () => {
        req.destroy();
        reject(new Error("Google TTS timeout"));
      });
    });
  }

  private pruneCache(): void {
    try {
      const files = fs
        .readdirSync(this.cacheDir)
        .filter((f) => f.endsWith(".mp3"))
        .map((f) => {
          const full = path.join(this.cacheDir, f);
          return { full, mtime: fs.statSync(full).mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      for (const file of files.slice(MAX_CACHE_FILES)) {
        fs.unlinkSync(file.full);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}
