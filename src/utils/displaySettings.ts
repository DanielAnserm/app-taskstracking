export const DISPLAY_SETTINGS_STORAGE_KEY = "time-tracking-display-settings";

export interface DisplaySettings {
  shortCalendarTaskThresholdMinutes: number;
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  shortCalendarTaskThresholdMinutes: 15,
};

function normalizeDisplaySettings(
  settings: Partial<DisplaySettings> | null | undefined,
): DisplaySettings {
  const threshold = settings?.shortCalendarTaskThresholdMinutes;

  return {
    shortCalendarTaskThresholdMinutes:
      typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 1
        ? threshold
        : DEFAULT_DISPLAY_SETTINGS.shortCalendarTaskThresholdMinutes,
  };
}

export function loadDisplaySettings(): DisplaySettings {
  try {
    const rawSettings = localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return DEFAULT_DISPLAY_SETTINGS;

    const parsed = JSON.parse(rawSettings) as Partial<DisplaySettings>;

    return normalizeDisplaySettings(parsed);
  } catch {
    return DEFAULT_DISPLAY_SETTINGS;
  }
}

export function saveDisplaySettings(settings: DisplaySettings) {
  localStorage.setItem(
    DISPLAY_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeDisplaySettings(settings)),
  );
}