export interface ParsedYoutubeUrl {
  channelId?: string;
  liveId?: string;
  handle?: string;
}

export function parseYoutubeUrl(input: string): ParsedYoutubeUrl {
  const trimmed = input.trim();
  if (!trimmed) return {};

  try {
    const url = trimmed.startsWith("http") ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");
    const result: ParsedYoutubeUrl = {};

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (id) result.liveId = id;
      return result;
    }

    if (!host.includes("youtube.com") && !host.includes("youtube-nocookie.com")) {
      return {};
    }

    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts[0] === "watch") {
      const videoId = url.searchParams.get("v");
      if (videoId) result.liveId = videoId;
      return result;
    }

    if (pathParts[0] === "channel" && pathParts[1]) {
      result.channelId = pathParts[1];
      return result;
    }

    if (pathParts[0]?.startsWith("@")) {
      result.handle = pathParts[0];
      return result;
    }

    if (pathParts[0] === "@" && pathParts[1]) {
      result.handle = `@${pathParts[1]}`;
      return result;
    }

    if (pathParts[0] === "live" && pathParts[1]) {
      result.liveId = pathParts[1];
      return result;
    }

    if (pathParts[0] === "c" && pathParts[1]) {
      result.handle = `@${pathParts[1]}`;
      return result;
    }

    if (pathParts[0] === "user" && pathParts[1]) {
      result.handle = `@${pathParts[1]}`;
      return result;
    }
  } catch {
    if (trimmed.startsWith("@")) {
      return { handle: trimmed };
    }
    if (trimmed.startsWith("UC") && trimmed.length >= 20) {
      return { channelId: trimmed };
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return { liveId: trimmed };
    }
  }

  return {};
}
