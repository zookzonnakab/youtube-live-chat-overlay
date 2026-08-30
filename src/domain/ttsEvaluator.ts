import type { DashboardSettings, NormalizedMessage } from "./types";

export type TtsCategory = "member" | "superchat" | "member-superchat";

const MAX_TEXT_LENGTH = 200;

export function getTtsCategory(message: NormalizedMessage): TtsCategory | null {
  if (message.superchat && message.author.isMember) return "member-superchat";
  if (message.superchat) return "superchat";
  if (message.author.isMember) return "member";
  return null;
}

export function shouldTts(settings: DashboardSettings, category: TtsCategory): boolean {
  if (!settings.ttsEnabled) return false;
  switch (category) {
    case "member":
      return settings.ttsMember;
    case "superchat":
      return settings.ttsSuperchat;
    case "member-superchat":
      return settings.ttsMemberSuperchat;
  }
}

function truncate(text: string, maxLen: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen) + "...";
}

export function buildTtsTexts(
  message: NormalizedMessage,
  category: TtsCategory,
  maxLen = MAX_TEXT_LENGTH
): { displayText: string; speechText: string } {
  const name = message.author.name;
  const text = truncate(message.text, maxLen);

  switch (category) {
    case "member-superchat":
      return {
        displayText: `⭐ สมาชิก Super Chat ${message.superchat!.amount} · @${name}: ${text}`,
        speechText: `สมาชิก Super Chat ${message.superchat!.amount} จาก ${name} พูดว่า ${text}`,
      };
    case "superchat":
      return {
        displayText: `💰 Super Chat ${message.superchat!.amount} · @${name}: ${text}`,
        speechText: `Super Chat ${message.superchat!.amount} จาก ${name} พูดว่า ${text}`,
      };
    case "member":
      return {
        displayText: `💎 สมาชิก @${name}: ${text}`,
        speechText: `สมาชิก ${name} พูดว่า ${text}`,
      };
  }
}
