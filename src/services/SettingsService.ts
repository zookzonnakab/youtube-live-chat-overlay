import fs from "fs";
import path from "path";
import type {
  DashboardSettings,
  OverlaySettings,
} from "../domain/types";
import {
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_OVERLAY_SETTINGS,
} from "../domain/types";
import { getDataDir } from "../appRoot";

const SETTINGS_PATH = () => path.join(getDataDir(), "settings.json");

interface StoredSettings {
  overlay?: Partial<OverlaySettings>;
  dashboard?: Partial<DashboardSettings>;
}

function readStored(): StoredSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH())) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH(), "utf-8")) as StoredSettings;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeStored(settings: StoredSettings): void {
  const dir = path.dirname(SETTINGS_PATH());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(settings, null, 2), "utf-8");
}

export class SettingsService {
  private overlay: OverlaySettings;
  private dashboard: DashboardSettings;

  constructor() {
    const stored = readStored();
    this.overlay = { ...DEFAULT_OVERLAY_SETTINGS, ...stored.overlay };
    this.dashboard = { ...DEFAULT_DASHBOARD_SETTINGS, ...stored.dashboard };
  }

  getOverlaySettings(): OverlaySettings {
    return { ...this.overlay };
  }

  getDashboardSettings(): DashboardSettings {
    return {
      ...this.dashboard,
      autoFeatureKeywords: [...this.dashboard.autoFeatureKeywords],
    };
  }

  updateOverlaySettings(partial: Partial<OverlaySettings>): OverlaySettings {
    this.overlay = { ...this.overlay, ...partial };
    const stored = readStored();
    stored.overlay = this.overlay;
    writeStored(stored);
    return this.getOverlaySettings();
  }

  updateDashboardSettings(partial: Partial<DashboardSettings>): DashboardSettings {
    this.dashboard = {
      ...this.dashboard,
      ...partial,
      autoFeatureKeywords:
        partial.autoFeatureKeywords ?? this.dashboard.autoFeatureKeywords,
    };
    const stored = readStored();
    stored.dashboard = this.dashboard;
    writeStored(stored);
    return this.getDashboardSettings();
  }

  shouldAutoFeature(text: string): boolean {
    if (this.dashboard.autoFeatureKeywords.length === 0) return false;
    const lower = text.toLowerCase();
    return this.dashboard.autoFeatureKeywords.some((kw) => {
      const k = kw.trim().toLowerCase();
      return k.length > 0 && lower.includes(k);
    });
  }
}
