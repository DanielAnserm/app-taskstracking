export const STATISTICS_SETTINGS_STORAGE_KEY = "time-tracking-statistics-settings";

export type WeekStartsOn = 0 | 1;

export interface StatisticsSettings {
  excludedWeekDays: number[];
  excludedTagIds: string[];
  nonWorkingDayThresholdMinutes: number;
  weekStartsOn: WeekStartsOn;
}

export const DEFAULT_STATISTICS_SETTINGS: StatisticsSettings = {
  excludedWeekDays: [5, 6],
  excludedTagIds: [],
  nonWorkingDayThresholdMinutes: 60,
  weekStartsOn: 1,
};

export function loadStatisticsSettings(): StatisticsSettings {
  try {
    const rawSettings = localStorage.getItem(STATISTICS_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return DEFAULT_STATISTICS_SETTINGS;

    const parsed = JSON.parse(rawSettings) as Partial<StatisticsSettings>;

    const parsedWeekStartsOn =
      parsed.weekStartsOn === 0 || parsed.weekStartsOn === 1
        ? parsed.weekStartsOn
        : DEFAULT_STATISTICS_SETTINGS.weekStartsOn;

    return {
      excludedWeekDays: Array.isArray(parsed.excludedWeekDays)
        ? parsed.excludedWeekDays
        : DEFAULT_STATISTICS_SETTINGS.excludedWeekDays,

      excludedTagIds: Array.isArray(parsed.excludedTagIds)
        ? parsed.excludedTagIds
        : DEFAULT_STATISTICS_SETTINGS.excludedTagIds,

      nonWorkingDayThresholdMinutes:
        typeof parsed.nonWorkingDayThresholdMinutes === "number"
          ? parsed.nonWorkingDayThresholdMinutes
          : DEFAULT_STATISTICS_SETTINGS.nonWorkingDayThresholdMinutes,

      weekStartsOn: parsedWeekStartsOn,
    };
  } catch {
    return DEFAULT_STATISTICS_SETTINGS;
  }
}

export function saveStatisticsSettings(settings: StatisticsSettings) {
  localStorage.setItem(STATISTICS_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}