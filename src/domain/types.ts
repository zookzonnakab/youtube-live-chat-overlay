export type ChatType = "live" | "top";

export interface AppConfig {
  port: number;
  channelId?: string;
  liveId?: string;
  handle?: string;
  chatType: ChatType;
}

export interface SuperchatInfo {
  amount: string;
  color: string;
}

export interface NormalizedMessage {
  id: string;
  author: {
    name: string;
    channelId: string;
    avatarUrl?: string;
    badgeUrl?: string;
    badgeLabel?: string;
    isMember: boolean;
    isModerator: boolean;
    isOwner: boolean;
    isVerified: boolean;
  };
  text: string;
  html: string;
  color: string;
  timestamp: string;
  superchat?: SuperchatInfo;
}

export interface ChatStatus {
  live: boolean;
  liveId?: string;
  error?: string;
  messageCount: number;
  running: boolean;
}

export type ScrollPosition = "right" | "left";
export type ScrollVertical = "bottom" | "middle";

export interface OverlaySettings {
  scrollFontSize: number;
  scrollMaxMessages: number;
  scrollPosition: ScrollPosition;
  scrollVertical: ScrollVertical;
  featuredOpacity: number;
  featuredFontSize: number;
}

export interface DashboardSettings {
  soundEnabled: boolean;
  soundSuperchat: boolean;
  soundMember: boolean;
  autoFeatureKeywords: string[];
  ttsEnabled: boolean;
  ttsMember: boolean;
  ttsSuperchat: boolean;
  ttsMemberSuperchat: boolean;
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  ttsMaxTextLength: number;
}

export type TtsCategory = "member" | "superchat" | "member-superchat";

export interface TtsPlayPayload {
  id: string;
  message: NormalizedMessage;
  category: TtsCategory;
  displayText: string;
  speechText: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface TtsQueueStatus {
  queueLength: number;
  playing: boolean;
  skipped: number;
}

export interface SystemStatus {
  wsConnected: number;
  scrollOverlayConnected: boolean;
  featuredOverlayConnected: boolean;
  ttsOverlayConnected: boolean;
  chatIngestRunning: boolean;
  chatLive: boolean;
}

export type WsEvent =
  | {
      type: "chat:history";
      payload: {
        messages: NormalizedMessage[];
        featured: NormalizedMessage | null;
        overlaySettings: OverlaySettings;
        dashboardSettings: DashboardSettings;
        featuredHistory: NormalizedMessage[];
      };
    }
  | { type: "chat:new"; payload: { message: NormalizedMessage } }
  | { type: "featured:update"; payload: { message: NormalizedMessage | null } }
  | { type: "featured:history"; payload: { history: NormalizedMessage[] } }
  | { type: "status:update"; payload: ChatStatus }
  | { type: "overlay:settings"; payload: OverlaySettings }
  | { type: "dashboard:settings"; payload: DashboardSettings }
  | { type: "system:status"; payload: SystemStatus }
  | { type: "notification"; payload: { kind: "superchat" | "member" | "auto-feature"; message: NormalizedMessage } }
  | { type: "tts:play"; payload: TtsPlayPayload }
  | { type: "tts:queue"; payload: TtsQueueStatus };

export interface ConfigUpdatePayload {
  channelId?: string;
  liveId?: string;
  handle?: string;
  chatType?: ChatType;
  youtubeUrl?: string;
}

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  scrollFontSize: 18,
  scrollMaxMessages: 15,
  scrollPosition: "right",
  scrollVertical: "bottom",
  featuredOpacity: 0.8,
  featuredFontSize: 22,
};

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  soundEnabled: true,
  soundSuperchat: true,
  soundMember: true,
  autoFeatureKeywords: [],
  ttsEnabled: false,
  ttsMember: true,
  ttsSuperchat: true,
  ttsMemberSuperchat: true,
  ttsRate: 1,
  ttsPitch: 1,
  ttsVolume: 1,
  ttsMaxTextLength: 200,
};
