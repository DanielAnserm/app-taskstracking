import type { TimeEntry } from "../types/domain";
import type { StatisticsSettings } from "./statisticsSettings";

export interface EntryTagLinkLike {
  timeEntryId: string;
  tagId: string;
}

export interface CountableEntriesResult {
  countableEntries: TimeEntry[];
  excludedEntries: TimeEntry[];
  activeStatDates: string[];
}

function getEntryDurationSeconds(entry: TimeEntry): number {
  if (typeof entry.durationSeconds === "number") {
    return Math.max(0, entry.durationSeconds);
  }

  const start = new Date(entry.startAt).getTime();
  const end = new Date(entry.endAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.round((end - start) / 1000));
}

function getWeekDayFromDateString(dateString: string): number {
  const date = new Date(`${dateString}T12:00:00`);
  return date.getDay();
}

function entryHasExcludedTag(
  entry: TimeEntry,
  tagLinks: EntryTagLinkLike[],
  excludedTagIds: string[],
): boolean {
  if (excludedTagIds.length === 0) return false;

  return tagLinks.some(
    (link) =>
      link.timeEntryId === entry.id && excludedTagIds.includes(link.tagId),
  );
}

export function getCountableEntries(
  entries: TimeEntry[],
  tagLinks: EntryTagLinkLike[],
  settings: StatisticsSettings,
): CountableEntriesResult {
  const excludedWeekDays = new Set(settings.excludedWeekDays);
  const excludedTagIds = settings.excludedTagIds;
  const thresholdSeconds =
    Math.max(0, settings.nonWorkingDayThresholdMinutes) * 60;

  const baseCountableEntries = entries.filter((entry) => {
    if (entry.isPause) return false;

    return !entryHasExcludedTag(entry, tagLinks, excludedTagIds);
  });

  const entriesByDate = new Map<string, TimeEntry[]>();

  for (const entry of baseCountableEntries) {
    const date = entry.date || entry.startAt.slice(0, 10);
    const currentEntries = entriesByDate.get(date) ?? [];
    currentEntries.push(entry);
    entriesByDate.set(date, currentEntries);
  }

  const activeStatDates = Array.from(entriesByDate.entries())
    .filter(([date, dateEntries]) => {
      const weekDay = getWeekDayFromDateString(date);

      if (!excludedWeekDays.has(weekDay)) return true;

      const totalSeconds = dateEntries.reduce(
        (sum, entry) => sum + getEntryDurationSeconds(entry),
        0,
      );

      return totalSeconds >= thresholdSeconds;
    })
    .map(([date]) => date)
    .sort();

  const activeStatDateSet = new Set(activeStatDates);

  const countableEntries = baseCountableEntries.filter((entry) => {
    const date = entry.date || entry.startAt.slice(0, 10);
    return activeStatDateSet.has(date);
  });

  const countableEntryIds = new Set(countableEntries.map((entry) => entry.id));
  const excludedEntries = entries.filter((entry) => !countableEntryIds.has(entry.id));

  return {
    countableEntries,
    excludedEntries,
    activeStatDates,
  };
}

export function getActiveStatDates(
  entries: TimeEntry[],
  tagLinks: EntryTagLinkLike[],
  settings: StatisticsSettings,
): string[] {
  return getCountableEntries(entries, tagLinks, settings).activeStatDates;
}