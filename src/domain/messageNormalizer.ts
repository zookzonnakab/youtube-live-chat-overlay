import type { ChatItem } from "youtube-chat-next";
import type { NormalizedMessage } from "./types";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hashChannelIdToColor(channelId: string): string {
  let hash = 0;
  for (let i = 0; i < channelId.length; i++) {
    hash = channelId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 65%)`;
}

export function normalizeChatItem(item: ChatItem): NormalizedMessage {
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  for (const part of item.message) {
    if ("text" in part) {
      textParts.push(part.text);
      htmlParts.push(escapeHtml(part.text));
    } else {
      textParts.push(part.emojiText);
      if (part.url) {
        htmlParts.push(
          `<img class="chat-emoji" src="${escapeHtml(part.url)}" alt="${escapeHtml(part.alt || part.emojiText)}" />`
        );
      } else {
        htmlParts.push(escapeHtml(part.emojiText));
      }
    }
  }

  const channelId = item.author.channelId || item.author.name;

  const message: NormalizedMessage = {
    id: item.id,
    author: {
      name: item.author.name,
      channelId,
      avatarUrl: item.author.thumbnail?.url,
      badgeUrl: item.author.badge?.thumbnail.url,
      badgeLabel: item.author.badge?.label,
      isMember: item.isMembership,
      isModerator: item.isModerator,
      isOwner: item.isOwner,
      isVerified: item.isVerified,
    },
    text: textParts.join(""),
    html: htmlParts.join(""),
    color: hashChannelIdToColor(channelId),
    timestamp: item.timestamp.toISOString(),
  };

  if (item.superchat) {
    message.superchat = {
      amount: item.superchat.amount,
      color: item.superchat.color,
    };
  }

  return message;
}
