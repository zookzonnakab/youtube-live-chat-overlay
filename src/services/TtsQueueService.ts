import { buildTtsTexts, getTtsCategory, shouldTts } from "../domain/ttsEvaluator";
import type { NormalizedMessage, TtsCategory, TtsPlayPayload } from "../domain/types";
import type { BroadcastService } from "./BroadcastService";
import type { SettingsService } from "./SettingsService";

const MAX_QUEUE = 5;

interface QueueItem {
  payload: TtsPlayPayload;
}

export class TtsQueueService {
  private queue: QueueItem[] = [];
  private playing = false;
  private skipped = 0;
  private playCounter = 0;

  constructor(
    private readonly broadcastService: BroadcastService,
    private readonly settingsService: SettingsService
  ) {
    this.broadcastService.onClientMessage((msg) => {
      if (msg.type === "tts:done") {
        this.onDone();
      }
    });
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      playing: this.playing,
      skipped: this.skipped,
    };
  }

  tryEnqueue(message: NormalizedMessage): void {
    const category = getTtsCategory(message);
    if (!category) return;

    const settings = this.settingsService.getDashboardSettings();
    if (!shouldTts(settings, category)) return;

    const { displayText, speechText } = buildTtsTexts(
      message,
      category,
      settings.ttsMaxTextLength
    );

    const payload: TtsPlayPayload = {
      id: `tts-${++this.playCounter}`,
      message,
      category,
      displayText,
      speechText,
      rate: settings.ttsRate,
      pitch: settings.ttsPitch,
      volume: settings.ttsVolume,
    };

    if (this.queue.length >= MAX_QUEUE) {
      this.queue.shift();
      this.skipped += 1;
    }

    this.queue.push({ payload });

    if (!this.playing) {
      this.playNext();
    } else {
      this.broadcastQueue();
    }
  }

  enqueueTest(category: TtsCategory = "member"): void {
    const testMessage: NormalizedMessage = {
      id: "tts-test",
      author: {
        name: "TestUser",
        channelId: "test",
        isMember: category === "member" || category === "member-superchat",
        isModerator: false,
        isOwner: false,
        isVerified: false,
      },
      text: "นี่คือการทดสอบเสียงอ่านออกเสียง",
      html: "นี่คือการทดสอบเสียงอ่านออกเสียง",
      color: "hsl(200, 70%, 65%)",
      timestamp: new Date().toISOString(),
      superchat:
        category === "superchat" || category === "member-superchat"
          ? { amount: "THB100.00", color: "#ff0000" }
          : undefined,
    };

    const settings = this.settingsService.getDashboardSettings();
    const { displayText, speechText } = buildTtsTexts(
      testMessage,
      category,
      settings.ttsMaxTextLength
    );

    const payload: TtsPlayPayload = {
      id: `tts-test-${Date.now()}`,
      message: testMessage,
      category,
      displayText,
      speechText,
      rate: settings.ttsRate,
      pitch: settings.ttsPitch,
      volume: settings.ttsVolume,
    };

    this.queue.unshift({ payload });
    if (!this.playing) {
      this.playNext();
    } else {
      this.broadcastQueue();
    }
  }

  clearQueue(): void {
    this.queue = [];
    this.playing = false;
    this.broadcastQueue();
  }

  private onDone(): void {
    this.playing = false;
    this.playNext();
  }

  private playNext(): void {
    const item = this.queue.shift();
    if (!item) {
      this.broadcastQueue();
      return;
    }

    this.playing = true;
    this.broadcastService.broadcast({
      type: "tts:play",
      payload: item.payload,
    });
    this.broadcastQueue();
  }

  private broadcastQueue(): void {
    this.broadcastService.broadcast({
      type: "tts:queue",
      payload: this.getStatus(),
    });
  }
}
