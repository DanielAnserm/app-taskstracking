import type { WeekStartsOn } from "./statisticsSettings";

export function getStartOfWeek(date: Date, weekStartsOn: WeekStartsOn): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const currentDay = result.getDay();
  const diff = (currentDay - weekStartsOn + 7) % 7;

  result.setDate(result.getDate() - diff);

  return result;
}

export function getEndOfWeek(date: Date, weekStartsOn: WeekStartsOn): Date {
  const result = getStartOfWeek(date, weekStartsOn);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);

  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getWeekDateKeys(date: Date, weekStartsOn: WeekStartsOn): string[] {
  const start = getStartOfWeek(date, weekStartsOn);

  return Array.from({ length: 7 }, (_, index) => {
    return formatDateKey(addDays(start, index));
  });
}

export function formatWeekRangeLabel(
  date: Date,
  weekStartsOn: WeekStartsOn,
): string {
  const start = getStartOfWeek(date, weekStartsOn);
  const end = getEndOfWeek(date, weekStartsOn);

  return `Du ${formatDateKey(start)} au ${formatDateKey(end)}`;
}