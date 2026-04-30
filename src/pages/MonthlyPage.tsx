import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/database";
import type { Tag, TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
  tags?: Tag[];
}

interface WeekBucket {
  key: string;
  weekNumber: number;
  label: string;
  rangeLabel: string;
  entries: EntryWithSector[];
  activeSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
}

interface MonthWeekRange {
  key: string;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  rangeLabel: string;
  startIndex: number;
  daysInMonth: number;
}

interface TaskSummary {
  sectorId: string;
  name: string;
  color: string;
  seconds: number;
  percentage: number;
  isPause: boolean;
}

interface DaySummary {
  date: string;
  dayNumber: number;
  label: string;
  shortLabel: string;
  entries: EntryWithSector[];
  activeSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
}

interface DayChartData extends DaySummary {
  sectorTotals: Array<{
    sectorId: string;
    seconds: number;
    color: string;
    name: string;
  }>;
}

type MonthlyViewMode = "chart" | "table";
type PauseFilterMode = "with_pauses" | "without_pauses";

function startOfMonth(date: Date): Date {
  const copy = new Date(date);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfMonth(date: Date): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + 1, 0);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months, 1);
  return startOfMonth(copy);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function getIsoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;

  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(date: Date): Date[] {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function getWeekStart(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekEnd(weekStart: Date): Date {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

function getWeekLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);

  return `${weekStart.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  })} → ${weekEnd.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  })}`;
}

function getWeekRangeLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();

  if (sameMonth) {
    return `${weekStart.toLocaleDateString("fr-CA", {
      day: "numeric",
    })} au ${weekEnd.toLocaleDateString("fr-CA", {
      day: "numeric",
      month: "long",
    })}`;
  }

  return `${weekStart.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
  })} au ${weekEnd.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
  })}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("fr-CA", {
    month: "long",
    year: "numeric",
  });
}

function formatDayLong(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatDayShort(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("fr-CA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTopDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const label = date.toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
  });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0 %";
  return `${Math.round(value * 10) / 10} %`;
}

function buildMonthWeekRanges(monthDate: Date): MonthWeekRange[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const ranges: MonthWeekRange[] = [];
  const cursor = getWeekStart(monthStart);

  while (cursor <= monthEnd) {
    const weekStart = new Date(cursor);
    const weekEnd = getWeekEnd(weekStart);
    const visibleStart = weekStart < monthStart ? monthStart : weekStart;
    const visibleEnd = weekEnd > monthEnd ? monthEnd : weekEnd;
    const startIndex = Math.floor((visibleStart.getTime() - monthStart.getTime()) / DAY_MS);
    const daysInMonth = Math.floor((visibleEnd.getTime() - visibleStart.getTime()) / DAY_MS) + 1;

    ranges.push({
      key: toDateKey(weekStart),
      weekNumber: getIsoWeekNumber(weekStart),
      startDate: weekStart,
      endDate: weekEnd,
      rangeLabel: getWeekRangeLabel(weekStart),
      startIndex,
      daysInMonth,
    });

    cursor.setDate(cursor.getDate() + 7);
  }

  return ranges;
}

export function MonthlyPage() {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [availableSectors, setAvailableSectors] = useState<WorkSector[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [pauseFilterMode, setPauseFilterMode] = useState<PauseFilterMode>("with_pauses");
  const [selectedFilterSectorId, setSelectedFilterSectorId] = useState("all");
  const [selectedFilterTagName, setSelectedFilterTagName] = useState("all");
  const [viewMode, setViewMode] = useState<MonthlyViewMode>("chart");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      const rawEntries = await db.timeEntries.toArray();
      const allSectors = await db.workSectors.toArray();
      const allTags = await db.tags.toArray();

      const usableSectors = allSectors
        .filter((sector) => sector.isActive && !sector.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      const usableTags = allTags
        .filter((tag) => tag.isActive && !tag.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name, "fr"));

      const enrichedEntries = await Promise.all(
        rawEntries.map(async (entry) => {
          const sector = await db.workSectors.get(entry.sectorId);
          const links = await db.timeEntryTags.where("timeEntryId").equals(entry.id).toArray();
          const tagResults = await Promise.all(links.map((link) => db.tags.get(link.tagId)));
          const tags = tagResults.filter(Boolean) as Tag[];

          return {
            ...entry,
            sector,
            tags,
          };
        }),
      );

      if (!cancelled) {
        setEntries(enrichedEntries);
        setAvailableSectors(usableSectors);
        setAvailableTags(usableTags);
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const monthStart = useMemo(() => startOfMonth(monthDate), [monthDate]);
  const monthEnd = useMemo(() => endOfMonth(monthDate), [monthDate]);
  const monthLabel = useMemo(() => getMonthLabel(monthDate), [monthDate]);
  const monthWeekRanges = useMemo(() => buildMonthWeekRanges(monthDate), [monthDate]);

  const monthlyEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.startAt);
        return entryDate >= monthStart && entryDate <= monthEnd;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [entries, monthStart, monthEnd]);

  const filteredMonthlyEntries = useMemo(() => {
    return monthlyEntries.filter((entry) => {
      const pauseOk = pauseFilterMode === "with_pauses" || !entry.isPause;
      const sectorOk =
        selectedFilterSectorId === "all" || entry.sectorId === selectedFilterSectorId;
      const tagOk =
        selectedFilterTagName === "all" ||
        Boolean(entry.tags?.some((tag) => tag.name === selectedFilterTagName));

      return pauseOk && sectorOk && tagOk;
    });
  }, [monthlyEntries, pauseFilterMode, selectedFilterSectorId, selectedFilterTagName]);

  const monthActiveSeconds = monthlyEntries
    .filter((entry) => !entry.isPause)
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);

  const monthPauseSeconds = monthlyEntries
    .filter((entry) => entry.isPause)
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);

  const monthTotalSeconds = monthActiveSeconds + monthPauseSeconds;
  const activeDays = new Set(monthlyEntries.map((entry) => entry.date)).size;
  const averagePerActiveDay = activeDays > 0 ? Math.floor(monthTotalSeconds / activeDays) : 0;

  const weeklyBuckets = useMemo<WeekBucket[]>(() => {
    const map = new Map<string, WeekBucket>();

    for (const weekRange of monthWeekRanges) {
      map.set(weekRange.key, {
        key: weekRange.key,
        weekNumber: weekRange.weekNumber,
        label: getWeekLabel(weekRange.startDate),
        rangeLabel: weekRange.rangeLabel,
        entries: [],
        activeSeconds: 0,
        pauseSeconds: 0,
        totalSeconds: 0,
      });
    }

    for (const entry of monthlyEntries) {
      const weekStart = getWeekStart(new Date(entry.startAt));

      const key = toDateKey(weekStart);
      const bucket = map.get(key);
      if (!bucket) continue;

      bucket.entries.push(entry);

      if (entry.isPause) {
        bucket.pauseSeconds += entry.durationSeconds;
      } else {
        bucket.activeSeconds += entry.durationSeconds;
      }

      bucket.totalSeconds += entry.durationSeconds;
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [monthWeekRanges, monthlyEntries]);

  const filteredWeeklyBuckets = useMemo<WeekBucket[]>(() => {
    const map = new Map<string, WeekBucket>();

    for (const weekRange of monthWeekRanges) {
      map.set(weekRange.key, {
        key: weekRange.key,
        weekNumber: weekRange.weekNumber,
        label: getWeekLabel(weekRange.startDate),
        rangeLabel: weekRange.rangeLabel,
        entries: [],
        activeSeconds: 0,
        pauseSeconds: 0,
        totalSeconds: 0,
      });
    }

    for (const entry of filteredMonthlyEntries) {
      const weekStart = getWeekStart(new Date(entry.startAt));

      const key = toDateKey(weekStart);
      const bucket = map.get(key);
      if (!bucket) continue;

      bucket.entries.push(entry);

      if (entry.isPause) {
        bucket.pauseSeconds += entry.durationSeconds;
      } else {
        bucket.activeSeconds += entry.durationSeconds;
      }

      bucket.totalSeconds += entry.durationSeconds;
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredMonthlyEntries, monthWeekRanges]);

  const averagePerWeek =
    weeklyBuckets.length > 0 ? Math.floor(monthTotalSeconds / weeklyBuckets.length) : 0;

  const topDays = useMemo(() => {
    const map = new Map<string, number>();

    for (const entry of monthlyEntries) {
      map.set(entry.date, (map.get(entry.date) ?? 0) + entry.durationSeconds);
    }

    return Array.from(map.entries())
      .map(([date, seconds]) => ({ date, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 3);
  }, [monthlyEntries]);

  const mostLoadedWeek = useMemo(() => {
    return weeklyBuckets.length > 0
      ? [...weeklyBuckets].sort((a, b) => b.totalSeconds - a.totalSeconds)[0]
      : undefined;
  }, [weeklyBuckets]);

  const leastLoadedWeek = useMemo(() => {
    return weeklyBuckets.length > 0
      ? [...weeklyBuckets].filter((week) => week.totalSeconds > 0).sort((a, b) => a.totalSeconds - b.totalSeconds)[0]
      : undefined;
  }, [weeklyBuckets]);

  const workRatio = monthTotalSeconds > 0 ? (monthActiveSeconds / monthTotalSeconds) * 100 : 0;
  const pauseRatio = monthTotalSeconds > 0 ? (monthPauseSeconds / monthTotalSeconds) * 100 : 0;

  const taskSummary = useMemo<TaskSummary[]>(() => {
    const map = new Map<string, { name: string; seconds: number; color: string; isPause: boolean }>();
    const totalSeconds = filteredMonthlyEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);

    for (const entry of filteredMonthlyEntries) {
      const existing = map.get(entry.sectorId);

      if (existing) {
        existing.seconds += entry.durationSeconds;
      } else {
        map.set(entry.sectorId, {
          name: entry.sector?.name ?? entry.sectorId,
          seconds: entry.durationSeconds,
          color: entry.sector?.color ?? (entry.isPause ? "#f59e0b" : "#737373"),
          isPause: entry.isPause,
        });
      }
    }

    return Array.from(map.entries())
      .map(([sectorId, item]) => ({
        sectorId,
        name: item.name,
        color: item.color,
        seconds: item.seconds,
        percentage: totalSeconds > 0 ? (item.seconds / totalSeconds) * 100 : 0,
        isPause: item.isPause,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [filteredMonthlyEntries]);

  const daySummaries = useMemo<DaySummary[]>(() => {
    return getDaysInMonth(monthDate).map((day) => {
      const date = toDateKey(day);
      const dayEntries = filteredMonthlyEntries.filter((entry) => entry.date === date);
      const activeSeconds = dayEntries
        .filter((entry) => !entry.isPause)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);
      const pauseSeconds = dayEntries
        .filter((entry) => entry.isPause)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);

      return {
        date,
        dayNumber: day.getDate(),
        label: formatDayLong(date),
        shortLabel: formatDayShort(date),
        entries: dayEntries,
        activeSeconds,
        pauseSeconds,
        totalSeconds: activeSeconds + pauseSeconds,
      };
    });
  }, [filteredMonthlyEntries, monthDate]);

  const dayChartData = useMemo<DayChartData[]>(() => {
    return daySummaries.map((day) => {
      const map = new Map<string, { name: string; seconds: number; color: string }>();

      for (const entry of day.entries) {
        const existing = map.get(entry.sectorId);

        if (existing) {
          existing.seconds += entry.durationSeconds;
        } else {
          map.set(entry.sectorId, {
            name: entry.sector?.name ?? entry.sectorId,
            seconds: entry.durationSeconds,
            color: entry.sector?.color ?? (entry.isPause ? "#f59e0b" : "#737373"),
          });
        }
      }

      return {
        ...day,
        sectorTotals: taskSummary
          .map((task) => ({
            sectorId: task.sectorId,
            seconds: map.get(task.sectorId)?.seconds ?? 0,
            color: task.color,
            name: task.name,
          }))
          .filter((item) => item.seconds > 0),
      };
    });
  }, [daySummaries, taskSummary]);

  const chartHeight = 320;
  const stepWidth = 34;
  const chartInnerWidth = Math.max(dayChartData.length * stepWidth, 900);
  const maxDaySeconds = Math.max(...dayChartData.map((day) => day.totalSeconds), 0);
  const chartMaxHours = Math.max(1, Math.ceil(maxDaySeconds / 3600));
  const chartMaxSeconds = chartMaxHours * 3600;
  const chartTicks = Array.from({ length: 5 }, (_, index) => (chartMaxHours / 4) * index);

  const linePoints = dayChartData
    .map((day, index) => {
      const x = index * stepWidth + stepWidth / 2;
      const y = chartHeight - (day.totalSeconds / chartMaxSeconds) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const filteredTotalSeconds = filteredMonthlyEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link
                to="/"
                className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
              >
                Retour à l’accueil
              </Link>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
                Suivi mensuel
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Vue globale du mois avec statistiques, filtres, graphique et tableau.
              </p>
            </div>

            <div className="grid grid-cols-1 justify-items-center gap-3 sm:grid-cols-[auto_auto_auto] lg:justify-items-end">
              <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold capitalize text-neutral-700 shadow-sm ring-1 ring-black/5 sm:col-start-2 sm:justify-self-center">
                {monthLabel}
              </div>

              <button
                type="button"
                onClick={() => setMonthDate((prev) => addMonths(prev, -1))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:col-start-1 sm:row-start-2"
              >
                Mois précédent
              </button>

              <button
                type="button"
                onClick={() => setMonthDate(startOfMonth(new Date()))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:col-start-2 sm:row-start-2"
              >
                Mois actuel
              </button>

              <button
                type="button"
                onClick={() => setMonthDate((prev) => addMonths(prev, 1))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 sm:col-start-3 sm:row-start-2"
              >
                Mois suivant
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps total du mois</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(monthTotalSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Moyenne hebdomadaire</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(averagePerWeek)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Moyenne journalière</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(averagePerActiveDay)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Nombre de jours actifs</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {activeDays}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Jours les plus chargés</p>
            {topDays.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">Aucune donnée</p>
            ) : (
              <div className="mt-3 space-y-2">
                {topDays.map((day) => (
                  <p key={day.date} className="text-sm font-semibold text-neutral-800">
                    {formatTopDayLabel(day.date)} — {formatDurationFromSeconds(day.seconds)}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Semaine la plus chargée</p>
            <p className="mt-2 text-xl font-bold text-neutral-900">
              {mostLoadedWeek ? `Semaine ${mostLoadedWeek.weekNumber}` : "—"}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
              {mostLoadedWeek ? formatDurationFromSeconds(mostLoadedWeek.totalSeconds) : "—"}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {mostLoadedWeek ? mostLoadedWeek.rangeLabel : "Aucune donnée"}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Semaine la moins chargée</p>
            <p className="mt-2 text-xl font-bold text-neutral-900">
              {leastLoadedWeek ? `Semaine ${leastLoadedWeek.weekNumber}` : "—"}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">
              {leastLoadedWeek ? formatDurationFromSeconds(leastLoadedWeek.totalSeconds) : "—"}
            </p>
            <p className="mt-1 text-sm text-neutral-600">
              {leastLoadedWeek ? leastLoadedWeek.rangeLabel : "Aucune donnée"}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Travail / pause</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {Math.round(workRatio)}% / {Math.round(pauseRatio)}%
            </p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-100 ring-1 ring-neutral-200">
              <div
                className="h-full bg-neutral-900"
                style={{ width: `${Math.round(workRatio)}%` }}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Filtres
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-medium text-neutral-500">
                  Avec ou sans pause
                </label>
                <select
                  value={pauseFilterMode}
                  onChange={(event) => setPauseFilterMode(event.target.value as PauseFilterMode)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none"
                >
                  <option value="with_pauses">Avec pauses</option>
                  <option value="without_pauses">Sans pauses</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-neutral-500">
                  Sélection des tâches
                </label>
                <select
                  value={selectedFilterSectorId}
                  onChange={(event) => setSelectedFilterSectorId(event.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none"
                >
                  <option value="all">Toutes les tâches</option>
                  {availableSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-neutral-500">
                  Sélection des tags
                </label>
                <select
                  value={selectedFilterTagName}
                  onChange={(event) => setSelectedFilterTagName(event.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none"
                >
                  <option value="all">Tous les tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">
              Affichage
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setViewMode("chart")}
                className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${
                  viewMode === "chart"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"
                }`}
              >
                Vue graphique
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${
                  viewMode === "table"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"
                }`}
              >
                Vue tableau
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                Activité du mois
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {viewMode === "chart"
                  ? "Colonnes empilées par tâches. Courbe : volume total journalier."
                  : "Vue détaillée jour par jour avec total, pause, tâche principale et nombre d’entrées."}
              </p>
            </div>

            <div className="rounded-full bg-neutral-50 px-4 py-2 text-sm font-semibold capitalize text-neutral-700 ring-1 ring-neutral-200">
              {monthLabel}
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-neutral-600">Chargement…</p>
          ) : filteredMonthlyEntries.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-600">
              Aucune donnée à afficher avec ces filtres.
            </p>
          ) : viewMode === "chart" ? (
            <div className="mt-6">
              <div className="mb-5 flex flex-wrap gap-2 text-xs">
                {taskSummary.map((item) => (
                  <span
                    key={item.sectorId}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-neutral-200"
                  >
                    <span
                      className="h-3 w-3 rounded-md"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                ))}
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 ring-1 ring-neutral-200">
                  <span className="h-[2px] w-5 bg-sky-500" />
                  Tendance
                </span>
              </div>

              <div className="overflow-x-auto pb-2 pl-10">
                <div className="min-w-[900px]">
                  <div
                    className="relative"
                    style={{ height: `${chartHeight + 24}px`, width: `${chartInnerWidth}px` }}
                  >
                    {chartTicks.map((tick) => {
                      const y = chartHeight - (tick / chartMaxHours) * chartHeight;
                      const tickLabel = Number.isInteger(tick)
                        ? `${tick}h`
                        : `${Math.round(tick * 10) / 10}h`;

                      return (
                        <div key={tickLabel}>
                          <div
                            className="absolute left-0 right-0 border-t border-neutral-200"
                            style={{ top: `${y}px` }}
                          />
                          <div
                            className="absolute -left-10 text-xs text-neutral-500"
                            style={{ top: `${y - 8}px` }}
                          >
                            {tickLabel}
                          </div>
                        </div>
                      );
                    })}

                    {monthWeekRanges.map((week) => (
                      <div
                        key={`week-line-${week.key}`}
                        className="absolute top-0 z-[1] border-l border-neutral-300"
                        style={{
                          left: `${week.startIndex * stepWidth}px`,
                          height: `${chartHeight}px`,
                        }}
                      />
                    ))}

                    <svg
                      className="absolute left-0 top-0 z-10"
                      width={chartInnerWidth}
                      height={chartHeight}
                      viewBox={`0 0 ${chartInnerWidth} ${chartHeight}`}
                    >
                      <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" points={linePoints} />
                    </svg>

                    <div className="absolute inset-0 flex items-end gap-1">
                      {dayChartData.map((day) => (
                        <div
                          key={day.date}
                          className="flex h-full w-[34px] flex-col justify-end gap-[2px]"
                          title={`${day.label} · ${formatDurationFromSeconds(day.totalSeconds)}`}
                        >
                          {day.sectorTotals.map((item, index) => {
                            const stackHeight = (item.seconds / chartMaxSeconds) * chartHeight;

                            return (
                              <div
                                key={`${day.date}-${item.sectorId}`}
                                className={index === day.sectorTotals.length - 1 ? "rounded-t-sm" : ""}
                                style={{
                                  height: `${stackHeight}px`,
                                  minHeight: item.seconds > 0 ? "3px" : undefined,
                                  backgroundColor: item.color,
                                }}
                                title={`${item.name} · ${formatDurationFromSeconds(item.seconds)}`}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    className="mt-2 flex gap-1 text-center text-[10px] text-neutral-500"
                    style={{ width: `${chartInnerWidth}px` }}
                  >
                    {dayChartData.map((day) => (
                      <div key={day.date} className="w-[34px]">
                        {day.dayNumber}
                      </div>
                    ))}
                  </div>

                  <div
                    className="relative mt-3 h-12 text-center text-[10px] font-medium text-neutral-500"
                    style={{ width: `${chartInnerWidth}px` }}
                  >
                    {monthWeekRanges.map((week) => (
                      <div
                        key={week.key}
                        className="absolute top-0 border-l border-t border-neutral-300 pt-2"
                        style={{
                          left: `${week.startIndex * stepWidth}px`,
                          width: `${Math.max(week.daysInMonth, 1) * stepWidth}px`,
                        }}
                      >
                        Semaine {week.weekNumber}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-neutral-500">
                    <th className="px-4 py-2">Jour</th>
                    <th className="px-4 py-2">Temps total</th>
                    <th className="px-4 py-2">Travail</th>
                    <th className="px-4 py-2">Pause</th>
                    <th className="px-4 py-2">Tâche principale</th>
                    <th className="px-4 py-2">Entrées</th>
                  </tr>
                </thead>
                <tbody>
                  {daySummaries
                    .filter((day) => day.totalSeconds > 0)
                    .map((day) => {
                      const topTask = day.entries.reduce<{
                        name: string;
                        color: string;
                        seconds: number;
                      } | null>((current, entry) => {
                        const name = entry.sector?.name ?? entry.sectorId;
                        const color = entry.sector?.color ?? (entry.isPause ? "#f59e0b" : "#737373");
                        const existingSeconds = day.entries
                          .filter((item) => item.sectorId === entry.sectorId)
                          .reduce((sum, item) => sum + item.durationSeconds, 0);

                        if (!current || existingSeconds > current.seconds) {
                          return { name, color, seconds: existingSeconds };
                        }

                        return current;
                      }, null);

                      return (
                        <tr key={day.date} className="bg-neutral-50 ring-1 ring-neutral-200">
                          <td className="rounded-l-2xl px-4 py-3 font-medium capitalize text-neutral-900">
                            {day.label}
                          </td>
                          <td className="px-4 py-3 font-semibold text-neutral-900">
                            {formatDurationFromSeconds(day.totalSeconds)}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {formatDurationFromSeconds(day.activeSeconds)}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {formatDurationFromSeconds(day.pauseSeconds)}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {topTask ? (
                              <span className="inline-flex items-center gap-2">
                                <span
                                  className="h-3 w-3 rounded-full"
                                  style={{ backgroundColor: topTask.color }}
                                />
                                {topTask.name}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="rounded-r-2xl px-4 py-3 text-neutral-700">
                            {day.entries.length}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">Répartition par tâches</h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Total par tâche sur le mois affiché.
                </p>
              </div>
              <p className="text-sm font-semibold text-neutral-500">
                {formatDurationFromSeconds(filteredTotalSeconds)}
              </p>
            </div>

            {taskSummary.length === 0 ? (
              <p className="mt-5 text-sm text-neutral-600">Aucune donnée à afficher.</p>
            ) : (
              <div className="mt-5 space-y-2.5">
                {taskSummary.map((task) => (
                  <div
                    key={task.sectorId}
                    className="rounded-2xl bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200"
                  >
                    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: task.color }}
                      />
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {task.name}
                      </p>
                      <p className="text-sm font-semibold text-neutral-900">
                        {formatDurationFromSeconds(task.seconds)}
                      </p>
                      <p className="text-xs text-neutral-500">{formatPercent(task.percentage)}</p>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${task.percentage}%`,
                          backgroundColor: task.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-semibold text-neutral-900">Semaine par semaine</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Temps total enregistré pendant chaque semaine du mois.
            </p>

            {filteredWeeklyBuckets.length === 0 ? (
              <p className="mt-5 text-sm text-neutral-600">Aucune donnée à afficher.</p>
            ) : (
              <div className="mt-5 space-y-2.5">
                {filteredWeeklyBuckets.map((week) => (
                  <div
                    key={week.key}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-50 px-4 py-3 ring-1 ring-neutral-200"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">
                        Semaine {week.weekNumber}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">{week.rangeLabel}</p>
                    </div>

                    <p className="text-sm font-semibold text-neutral-900">
                      {formatDurationFromSeconds(week.totalSeconds)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
