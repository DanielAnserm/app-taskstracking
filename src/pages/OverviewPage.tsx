import { useEffect, useMemo, useState } from "react";
import PageHeaderNav from "../components/PageHeaderNav";
import { db } from "../db/database";
import type { EntryAction, SubTask, Tag, TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";
import { loadStatisticsSettings } from "../utils/statisticsSettings";
import { getCountableEntries } from "../utils/statisticsFilters";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
  subTask?: SubTask;
  tags?: Tag[];
  actions?: EntryAction[];
}

type RangeKey = "7d" | "30d" | "90d" | "all";
type ViewMode = "trend" | "distribution" | "table";

interface WeekdayBucket {
  key: number;
  label: string;
  activeSeconds: number;
  pauseSeconds: number;
  entryCount: number;
}

interface SectorBucket {
  sectorId: string;
  sectorName: string;
  color: string;
  activeSeconds: number;
  entryCount: number;
  percentage: number;
}

interface TagBucket {
  tagId: string;
  tagName: string;
  activeSeconds: number;
}

interface SubTaskBucket {
  subTaskId: string;
  subTaskName: string;
  activeSeconds: number;
}

interface ActionBucket {
  actionType: string;
  totalQuantity: number;
  entryCount: number;
}

interface ProductiveDay {
  date: string;
  activeSeconds: number;
  pauseSeconds: number;
  entryCount: number;
}

interface HourBucket {
  hour: number;
  label: string;
  activeSeconds: number;
  pauseSeconds: number;
}

interface MonthBucket {
  key: string;
  label: string;
  shortLabel: string;
  activeSeconds: number;
  pauseSeconds: number;
  entryCount: number;
  activeDays: Set<string>;
}

interface WeekBucket {
  key: string;
  label: string;
  rangeLabel: string;
  activeSeconds: number;
  pauseSeconds: number;
  entryCount: number;
}

interface PieSegment extends SectorBucket {
  arcLength: number;
  offset: number;
}

function startDateForRange(range: RangeKey): Date | null {
  if (range === "all") return null;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "7d") {
    start.setDate(start.getDate() - 6);
  } else if (range === "30d") {
    start.setDate(start.getDate() - 29);
  } else {
    start.setDate(start.getDate() - 89);
  }

  return start;
}

function weekdayLabel(day: number): string {
  const labels = [
    "Dimanche",
    "Lundi",
    "Mardi",
    "Mercredi",
    "Jeudi",
    "Vendredi",
    "Samedi",
  ];
  return labels[day];
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}h–${String((hour + 1) % 24).padStart(2, "0")}h`;
}

function getRangeLabel(range: RangeKey): string {
  if (range === "7d") return "7 derniers jours";
  if (range === "30d") return "30 derniers jours";
  if (range === "90d") return "90 derniers jours";
  return "Toutes les données";
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("fr-CA", {
    month: "long",
    year: "numeric",
  });
}

function getMonthShortLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("fr-CA", {
    month: "short",
  });

  return monthLabel.replace(".", "");
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
  const copy = new Date(weekStart);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function getWeekKey(date: Date): string {
  const weekStart = getWeekStart(date);
  return weekStart.toISOString().slice(0, 10);
}

function getISOWeekNumber(date: Date): number {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  return Math.ceil(((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekRangeLabel(weekStart: Date): string {
  const weekEnd = getWeekEnd(weekStart);

  return `${weekStart.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  })} au ${weekEnd.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  })}`;
}

function formatDateLong(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString("fr-CA", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  });
}

function safeDuration(seconds: number): string {
  return seconds > 0 ? formatDurationFromSeconds(seconds) : "0 min";
}

export function OverviewPage() {
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");
  const [viewMode, setViewMode] = useState<ViewMode>("trend");
  const statisticsSettings = useMemo(() => loadStatisticsSettings(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      const rawEntries = await db.timeEntries.toArray();
      const enrichedEntries = await Promise.all(
        rawEntries.map(async (entry) => {
          const sector = await db.workSectors.get(entry.sectorId);
          const subTask = entry.subTaskId ? await db.subTasks.get(entry.subTaskId) : undefined;
          const links = await db.timeEntryTags.where("timeEntryId").equals(entry.id).toArray();
          const tagResults = await Promise.all(links.map((link) => db.tags.get(link.tagId)));
          const tags = tagResults.filter(Boolean) as Tag[];
          const actions = await db.entryActions.where("timeEntryId").equals(entry.id).toArray();

          return {
            ...entry,
            sector,
            subTask,
            tags,
            actions,
          };
        }),
      );

      if (!cancelled) {
        setEntries(enrichedEntries);
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const start = startDateForRange(range);

    return entries
      .filter((entry) => !start || new Date(entry.startAt) >= start)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [entries, range]);

  const tagLinksForFilteredEntries = useMemo(() => {
    return filteredEntries.flatMap((entry) =>
      (entry.tags ?? []).map((tag) => ({
        timeEntryId: entry.id,
        tagId: tag.id,
      })),
    );
  }, [filteredEntries]);

  const countableStats = useMemo(() => {
    return getCountableEntries(
      filteredEntries,
      tagLinksForFilteredEntries,
      statisticsSettings,
    );
  }, [filteredEntries, tagLinksForFilteredEntries, statisticsSettings]);

  const activeEntries = countableStats.countableEntries as EntryWithSector[];
  const countableEntryIds = useMemo(
    () => new Set(activeEntries.map((entry) => entry.id)),
    [activeEntries],
  );

  const pauseEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.isPause),
    [filteredEntries],
  );

  const registeredActiveSeconds = filteredEntries
    .filter((entry) => !entry.isPause)
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);

  const totalActiveSeconds = activeEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );
  const totalPauseSeconds = pauseEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );
  const totalSeconds = registeredActiveSeconds + totalPauseSeconds;
  const activeDays = countableStats.activeStatDates.length;
  const excludedStatSeconds = Math.max(0, registeredActiveSeconds - totalActiveSeconds);

  const monthBuckets = useMemo<MonthBucket[]>(() => {
    const map = new Map<string, MonthBucket>();

    for (const entry of filteredEntries) {
      const date = new Date(entry.startAt);
      const key = getMonthKey(date);
      const isCountableActiveEntry = !entry.isPause && countableEntryIds.has(entry.id);
      const existing = map.get(key);

      if (existing) {
        if (entry.isPause) {
          existing.pauseSeconds += entry.durationSeconds;
        } else if (isCountableActiveEntry) {
          existing.activeSeconds += entry.durationSeconds;
        }
        existing.entryCount += 1;
        if (isCountableActiveEntry) existing.activeDays.add(entry.date);
      } else {
        map.set(key, {
          key,
          label: getMonthLabelFromKey(key),
          shortLabel: getMonthShortLabelFromKey(key),
          activeSeconds: isCountableActiveEntry ? entry.durationSeconds : 0,
          pauseSeconds: entry.isPause ? entry.durationSeconds : 0,
          entryCount: 1,
          activeDays: new Set(isCountableActiveEntry ? [entry.date] : []),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredEntries, countableEntryIds]);

  const weekBuckets = useMemo<WeekBucket[]>(() => {
    const map = new Map<string, WeekBucket>();

    for (const entry of filteredEntries) {
      const date = new Date(entry.startAt);
      const key = getWeekKey(date);
      const isCountableActiveEntry = !entry.isPause && countableEntryIds.has(entry.id);
      const existing = map.get(key);

      if (existing) {
        if (entry.isPause) {
          existing.pauseSeconds += entry.durationSeconds;
        } else if (isCountableActiveEntry) {
          existing.activeSeconds += entry.durationSeconds;
        }
        existing.entryCount += 1;
      } else {
        const weekStart = getWeekStart(date);
        map.set(key, {
          key,
          label: `Semaine ${getISOWeekNumber(weekStart)}`,
          rangeLabel: getWeekRangeLabel(weekStart),
          activeSeconds: isCountableActiveEntry ? entry.durationSeconds : 0,
          pauseSeconds: entry.isPause ? entry.durationSeconds : 0,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filteredEntries, countableEntryIds]);

  const weekdayBuckets = useMemo<WeekdayBucket[]>(() => {
    const buckets: WeekdayBucket[] = Array.from({ length: 7 }, (_, day) => ({
      key: day,
      label: weekdayLabel(day),
      activeSeconds: 0,
      pauseSeconds: 0,
      entryCount: 0,
    }));

    for (const entry of activeEntries) {
      const day = new Date(entry.startAt).getDay();
      buckets[day].activeSeconds += entry.durationSeconds;
      buckets[day].entryCount += 1;
    }

    return buckets.sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activeEntries]);

  const sectorBuckets = useMemo<SectorBucket[]>(() => {
    const map = new Map<string, Omit<SectorBucket, "percentage">>();

    for (const entry of activeEntries) {
      const key = entry.sectorId;
      const existing = map.get(key);

      if (existing) {
        existing.activeSeconds += entry.durationSeconds;
        existing.entryCount += 1;
      } else {
        map.set(key, {
          sectorId: key,
          sectorName: entry.sector?.name ?? key,
          color: entry.sector?.color ?? "#737373",
          activeSeconds: entry.durationSeconds,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values())
      .map((bucket) => ({
        ...bucket,
        percentage: totalActiveSeconds > 0 ? (bucket.activeSeconds / totalActiveSeconds) * 100 : 0,
      }))
      .sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activeEntries, totalActiveSeconds]);

  const subTaskBuckets = useMemo<SubTaskBucket[]>(() => {
    const map = new Map<string, SubTaskBucket>();

    for (const entry of activeEntries) {
      if (!entry.subTaskId) continue;

      const existing = map.get(entry.subTaskId);

      if (existing) {
        existing.activeSeconds += entry.durationSeconds;
      } else {
        map.set(entry.subTaskId, {
          subTaskId: entry.subTaskId,
          subTaskName: entry.subTask?.name ?? entry.subTaskId,
          activeSeconds: entry.durationSeconds,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activeEntries]);

  const actionBuckets = useMemo<ActionBucket[]>(() => {
    const map = new Map<string, ActionBucket>();

    for (const entry of activeEntries) {
      const entryActions = entry.actions ?? [];

      for (const action of entryActions) {
        const key = action.actionType.trim().toLowerCase();
        const existing = map.get(key);

        if (existing) {
          existing.totalQuantity += action.quantity;
          existing.entryCount += 1;
        } else {
          map.set(key, {
            actionType: action.actionType,
            totalQuantity: action.quantity,
            entryCount: 1,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  }, [activeEntries]);

  const totalActionQuantity = actionBuckets.reduce(
    (sum, action) => sum + action.totalQuantity,
    0,
  );

  const tagBuckets = useMemo<TagBucket[]>(() => {
    const map = new Map<string, TagBucket>();

    for (const entry of activeEntries) {
      const entryTags = entry.tags ?? [];
      for (const tag of entryTags) {
        const existing = map.get(tag.id);

        if (existing) {
          existing.activeSeconds += entry.durationSeconds;
        } else {
          map.set(tag.id, {
            tagId: tag.id,
            tagName: tag.name,
            activeSeconds: entry.durationSeconds,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activeEntries]);

  const productiveDays = useMemo<ProductiveDay[]>(() => {
    const map = new Map<string, ProductiveDay>();

    for (const entry of activeEntries) {
      const existing = map.get(entry.date);

      if (existing) {
        existing.activeSeconds += entry.durationSeconds;
        existing.entryCount += 1;
      } else {
        map.set(entry.date, {
          date: entry.date,
          activeSeconds: entry.durationSeconds,
          pauseSeconds: 0,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activeEntries]);

  const hourBuckets = useMemo<HourBucket[]>(() => {
    const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: hourLabel(hour),
      activeSeconds: 0,
      pauseSeconds: 0,
    }));

    for (const entry of activeEntries) {
      const hour = new Date(entry.startAt).getHours();
      buckets[hour].activeSeconds += entry.durationSeconds;
    }

    return buckets;
  }, [activeEntries]);

  const topProductiveHours = useMemo(() => {
    return [...hourBuckets]
      .filter((bucket) => bucket.activeSeconds > 0)
      .sort((a, b) => b.activeSeconds - a.activeSeconds)
      .slice(0, 3);
  }, [hourBuckets]);

  const lowProductiveHours = useMemo(() => {
    return [...hourBuckets]
      .filter((bucket) => bucket.activeSeconds > 0)
      .sort((a, b) => a.activeSeconds - b.activeSeconds)
      .slice(0, 3);
  }, [hourBuckets]);

  const averageSessionSeconds =
    activeEntries.length > 0 ? Math.floor(totalActiveSeconds / activeEntries.length) : 0;

  const averageTaskChangesPerDay = useMemo(() => {
    const grouped = new Map<string, EntryWithSector[]>();

    for (const entry of activeEntries) {
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    }

    if (grouped.size === 0) return 0;

    let totalChanges = 0;

    for (const [, dayEntries] of grouped) {
      const sorted = [...dayEntries].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );

      let changes = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].sectorId !== sorted[i - 1].sectorId) {
          changes += 1;
        }
      }

      totalChanges += changes;
    }

    return totalChanges / grouped.size;
  }, [activeEntries]);

  const mostFragmentedDay = useMemo(() => {
    const grouped = new Map<string, EntryWithSector[]>();

    for (const entry of activeEntries) {
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    }

    let result: { date: string; changes: number } | null = null;

    for (const [date, dayEntries] of grouped) {
      const sorted = [...dayEntries].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );

      let changes = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].sectorId !== sorted[i - 1].sectorId) {
          changes += 1;
        }
      }

      if (!result || changes > result.changes) {
        result = { date, changes };
      }
    }

    return result;
  }, [activeEntries]);

  const leastFragmentedDay = useMemo(() => {
    const grouped = new Map<string, EntryWithSector[]>();

    for (const entry of activeEntries) {
      const list = grouped.get(entry.date) ?? [];
      list.push(entry);
      grouped.set(entry.date, list);
    }

    let result: { date: string; changes: number } | null = null;

    for (const [date, dayEntries] of grouped) {
      const sorted = [...dayEntries].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );

      let changes = 0;
      for (let i = 1; i < sorted.length; i += 1) {
        if (sorted[i].sectorId !== sorted[i - 1].sectorId) {
          changes += 1;
        }
      }

      if (!result || changes < result.changes) {
        result = { date, changes };
      }
    }

    return result;
  }, [activeEntries]);

  const workShare = totalSeconds > 0 ? Math.round((registeredActiveSeconds / totalSeconds) * 100) : 0;
  const pauseShare = totalSeconds > 0 ? 100 - workShare : 0;

  const averageDailySeconds = activeDays > 0 ? Math.floor(totalActiveSeconds / activeDays) : 0;
  const activeWeekBuckets = weekBuckets.filter((week) => week.activeSeconds > 0);
  const activeMonthBuckets = monthBuckets.filter((month) => month.activeSeconds > 0);
  const averageWeeklySeconds =
    activeWeekBuckets.length > 0 ? Math.floor(totalActiveSeconds / activeWeekBuckets.length) : 0;
  const averageMonthlySeconds =
    activeMonthBuckets.length > 0 ? Math.floor(totalActiveSeconds / activeMonthBuckets.length) : 0;

  const bestWeek = [...activeWeekBuckets].sort((a, b) => b.activeSeconds - a.activeSeconds)[0];
  const bestMonth = [...activeMonthBuckets].sort((a, b) => b.activeSeconds - a.activeSeconds)[0];
  const lightestMonth = [...monthBuckets]
    .filter((month) => month.activeSeconds > 0)
    .sort((a, b) => a.activeSeconds - b.activeSeconds)[0];
  const highestPauseMonth = [...monthBuckets]
    .filter((month) => month.pauseSeconds > 0)
    .sort((a, b) => b.pauseSeconds / Math.max(1, b.activeSeconds + b.pauseSeconds) - a.pauseSeconds / Math.max(1, a.activeSeconds + a.pauseSeconds))[0];
  const topSector = sectorBuckets[0];

  const energySummary = useMemo(() => {
    const map = new Map<string, number>();

    for (const entry of activeEntries) {
      const energy = entry.energy;
      if (!energy) continue;
      map.set(energy, (map.get(energy) ?? 0) + 1);
    }

    const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1])[0];
    return top?.[0] ?? "—";
  }, [activeEntries]);

  const trendHeight = 240;
  const trendStep = 72;
  const trendWidth = Math.max(monthBuckets.length, 1) * trendStep;
  const trendMax = Math.max(...monthBuckets.map((month) => month.activeSeconds), 1);
  const trendPoints = monthBuckets
    .map((month, index) => {
      const x = index * trendStep + trendStep / 2;
      const y = trendHeight - (month.activeSeconds / trendMax) * trendHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const pieRadius = 92;
  const pieCircumference = 2 * Math.PI * pieRadius;
  let pieOffset = 0;
  const pieSegments: PieSegment[] = sectorBuckets.map((sector) => {
    const arcLength = totalActiveSeconds > 0 ? (sector.activeSeconds / totalActiveSeconds) * pieCircumference : 0;
    const segment = {
      ...sector,
      arcLength,
      offset: pieOffset,
    };
    pieOffset += arcLength;
    return segment;
  });

  const keyMetrics = [
    {
      title: "Temps comptabilisé",
      value:
        excludedStatSeconds > 0
          ? `${safeDuration(totalActiveSeconds)} / ${safeDuration(registeredActiveSeconds)} enregistré`
          : safeDuration(totalActiveSeconds),
    },
    { title: "Moyenne mensuelle", value: safeDuration(averageMonthlySeconds) },
    { title: "Moyenne hebdomadaire", value: safeDuration(averageWeeklySeconds) },
    { title: "Moyenne / jour actif", value: safeDuration(averageDailySeconds) },
    { title: "Jours actifs statistiques", value: String(activeDays) },
    { title: "Répartition travail / pause", value: `${workShare}% / ${pauseShare}%` },
    {
      title: "Semaine record",
      value: bestWeek ? `Semaine du ${bestWeek.rangeLabel}` : "—",
      detail: bestWeek ? safeDuration(bestWeek.activeSeconds) : "",
    },
    {
      title: "Mois record",
      value: bestMonth ? `${bestMonth.label} — ${safeDuration(bestMonth.activeSeconds)}` : "—",
    },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeaderNav
          currentPage="global"
          title="Vue globale"
          subtitle="Vue transversale pour suivre les tendances générales, hors pauses, tags exclus et petits dépannages."
          rightSlot={
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm ring-1 ring-neutral-300">
                {getRangeLabel(range)}
              </div>
              <button
                type="button"
                onClick={() => setRange("all")}
                className={`rounded-full px-4 py-2 text-sm font-medium shadow-sm ${
                  range === "all"
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-50"
                }`}
              >
                Toutes les données
              </button>
            </div>
          }
        />

        <section className="space-y-4 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-4">
            {keyMetrics.map((metric) => (
              <div
                key={metric.title}
                className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200"
              >
                <p className="text-sm text-neutral-500">{metric.title}</p>
                <p className="mt-1 text-base font-semibold text-neutral-900">{metric.value}</p>
                {"detail" in metric && metric.detail ? (
                  <p className="mt-1 text-xl font-bold text-neutral-900">{metric.detail}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-3xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">Filtres</h2>
              <div className="flex flex-wrap gap-2">
                {([
                  ["7d", "7 jours"],
                  ["30d", "30 jours"],
                  ["90d", "90 jours"],
                  ["all", "Toutes les données"],
                ] as Array<[RangeKey, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRange(value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                      range === value
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-600">Tri / affichage</h2>
              <div className="flex flex-wrap gap-2">
                {([
                  ["trend", "Tendance"],
                  ["distribution", "Répartition"],
                  ["table", "Tableau"],
                ] as Array<[ViewMode, string]>).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setViewMode(value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                      viewMode === value
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
              <p className="text-sm text-neutral-600">Chargement…</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-3xl bg-neutral-50 p-6 ring-1 ring-neutral-200">
              <p className="text-sm text-neutral-600">Aucune donnée à afficher sur cette période.</p>
            </div>
          ) : (
            <>
              {viewMode === "trend" ? (
                <div className="overflow-hidden rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-base font-semibold text-neutral-900">Tendance globale</h2>
                      <p className="text-sm text-neutral-500">Évolution du volume de travail actif au fil des mois.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto pb-2 pl-10">
                    <div className="min-w-[720px]">
                      <div className="relative" style={{ height: `${trendHeight + 24}px`, width: `${trendWidth}px` }}>
                        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                          const y = trendHeight - fraction * trendHeight;
                          const value = trendMax * fraction;
                          return (
                            <div key={fraction}>
                              <div className="absolute left-0 right-0 border-t border-neutral-200" style={{ top: `${y}px` }} />
                              <div className="absolute -left-10 text-xs text-neutral-500" style={{ top: `${y - 8}px` }}>
                                {formatDurationFromSeconds(Math.round(value))}
                              </div>
                            </div>
                          );
                        })}

                        <svg
                          className="absolute left-0 top-0 z-10"
                          width={trendWidth}
                          height={trendHeight}
                          viewBox={`0 0 ${trendWidth} ${trendHeight}`}
                        >
                          {trendPoints ? (
                            <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" points={trendPoints} />
                          ) : null}
                          {monthBuckets.map((month, index) => {
                            const x = index * trendStep + trendStep / 2;
                            const y = trendHeight - (month.activeSeconds / trendMax) * trendHeight;
                            return <circle key={month.key} cx={x} cy={y} r="4" fill="#0ea5e9" />;
                          })}
                        </svg>
                      </div>

                      <div className="mt-2 flex text-center text-[10px] text-neutral-500" style={{ width: `${trendWidth}px` }}>
                        {monthBuckets.map((month) => (
                          <div key={month.key} className="w-[72px]">
                            {month.shortLabel}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {viewMode === "distribution" ? (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                      Répartition globale par secteur
                    </h2>
                    <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-center">
                      <div className="flex items-center justify-center">
                        <div className="relative flex items-center justify-center">
                          <svg width="240" height="240" viewBox="0 0 240 240" className="-rotate-90">
                            <circle cx="120" cy="120" r={pieRadius} fill="none" stroke="#ececec" strokeWidth="34" />
                            {pieSegments.map((item) => {
                              const dashOffset = pieCircumference / 4 - item.offset;
                              return (
                                <circle
                                  key={item.sectorId}
                                  cx="120"
                                  cy="120"
                                  r={pieRadius}
                                  fill="none"
                                  stroke={item.color}
                                  strokeWidth="34"
                                  strokeLinecap="butt"
                                  strokeDasharray={`${item.arcLength} ${pieCircumference - item.arcLength}`}
                                  strokeDashoffset={dashOffset}
                                />
                              );
                            })}
                          </svg>
                          <div className="absolute text-center">
                            <p className="text-sm text-neutral-500">Répartition</p>
                            <p className="mt-1 text-xl font-bold text-neutral-900">100%</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {sectorBuckets.map((sector) => (
                          <div key={sector.sectorId} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: sector.color }} />
                                <span className="truncate text-neutral-700">{sector.sectorName}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                <span className="text-xs text-neutral-500">{formatPercent(sector.percentage)}</span>
                                <span className="font-semibold text-neutral-900">{formatDurationFromSeconds(sector.activeSeconds)}</span>
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-neutral-100 ring-1 ring-neutral-200">
                              <div
                                className="h-2 rounded-full"
                                style={{ width: `${sector.percentage}%`, backgroundColor: sector.color }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Comparatifs globaux</h2>
                    <div className="space-y-2">
                      {[
                        ["Mois le plus productif", bestMonth ? `${bestMonth.label} — ${safeDuration(bestMonth.activeSeconds)}` : "—"],
                        ["Mois le plus léger", lightestMonth ? `${lightestMonth.label} — ${safeDuration(lightestMonth.activeSeconds)}` : "—"],
                        [
                          "Plus forte part de pauses",
                          highestPauseMonth
                            ? `${highestPauseMonth.label} — ${formatPercent((highestPauseMonth.pauseSeconds / Math.max(1, highestPauseMonth.activeSeconds + highestPauseMonth.pauseSeconds)) * 100)}`
                            : "—",
                        ],
                        ["Énergie moyenne dominante", energySummary],
                        ["Tâche la plus récurrente", topSector?.sectorName ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                          <span className="text-sm text-neutral-700">{label}</span>
                          <span className="text-right text-sm font-semibold text-neutral-900">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {viewMode === "table" ? (
                <div className="overflow-hidden rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="mb-4">
                    <h2 className="text-base font-semibold text-neutral-900">Tableau mensuel global</h2>
                    <p className="text-sm text-neutral-500">Résumé par mois pour comparer les volumes et le ratio travail / pause.</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wide text-neutral-500">
                          <th className="px-4 py-2">Mois</th>
                          <th className="px-4 py-2">Travail</th>
                          <th className="px-4 py-2">Pause</th>
                          <th className="px-4 py-2">Total</th>
                          <th className="px-4 py-2">Jours actifs</th>
                          <th className="px-4 py-2">Entrées</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthBuckets.map((month) => (
                          <tr key={month.key} className="bg-white ring-1 ring-neutral-200">
                            <td className="rounded-l-2xl px-4 py-3 font-medium capitalize text-neutral-900">{month.label}</td>
                            <td className="px-4 py-3 font-semibold text-neutral-900">{formatDurationFromSeconds(month.activeSeconds)}</td>
                            <td className="px-4 py-3 text-neutral-700">{formatDurationFromSeconds(month.pauseSeconds)}</td>
                            <td className="px-4 py-3 text-neutral-700">{formatDurationFromSeconds(month.activeSeconds + month.pauseSeconds)}</td>
                            <td className="px-4 py-3 text-neutral-700">{month.activeDays.size}</td>
                            <td className="rounded-r-2xl px-4 py-3 text-neutral-700">{month.entryCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Jours les plus productifs</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    {productiveDays.slice(0, 3).map((day) => (
                      <div key={day.date} className="rounded-2xl bg-white px-3 py-3 font-semibold ring-1 ring-neutral-200">
                        {formatDateLong(day.date)} — {formatDurationFromSeconds(day.activeSeconds)}
                      </div>
                    ))}
                    {productiveDays.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée.</p> : null}
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Périodes les plus productives</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    {topProductiveHours.map((bucket) => (
                      <div key={bucket.hour} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        {bucket.label} — {formatDurationFromSeconds(bucket.activeSeconds)}
                      </div>
                    ))}
                    {topProductiveHours.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée.</p> : null}
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Périodes creuses</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    {lowProductiveHours.map((bucket) => (
                      <div key={bucket.hour} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        {bucket.label} — {formatDurationFromSeconds(bucket.activeSeconds)}
                      </div>
                    ))}
                    {lowProductiveHours.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée.</p> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Évolution de l’énergie moyenne</h2>
                  <div className="space-y-2">
                    {monthBuckets.slice(-4).map((month) => (
                      <div key={month.key} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        <span className="text-sm capitalize text-neutral-700">{month.label}</span>
                        <span className="text-sm font-semibold text-neutral-900">{energySummary}</span>
                      </div>
                    ))}
                    {monthBuckets.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée.</p> : null}
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Répartition par jour de la semaine</h2>
                  <div className="space-y-2">
                    {weekdayBuckets.map((day) => (
                      <div key={day.key} className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        <span className="text-sm text-neutral-700">{day.label}</span>
                        <span className="text-sm font-semibold text-neutral-900">{formatDurationFromSeconds(day.activeSeconds)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Top sous-tâches / top tags</h2>
                  <div className="space-y-2">
                    {[...subTaskBuckets.slice(0, 3).map((item) => [`${item.subTaskName}`, item.activeSeconds] as const), ...tagBuckets.slice(0, 3).map((item) => [`Tag : ${item.tagName}`, item.activeSeconds] as const)].slice(0, 5).map(([label, seconds]) => (
                      <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        <span className="truncate text-sm text-neutral-700">{label}</span>
                        <span className="shrink-0 text-sm font-semibold text-neutral-900">{formatDurationFromSeconds(seconds)}</span>
                      </div>
                    ))}
                    {subTaskBuckets.length === 0 && tagBuckets.length === 0 ? <p className="text-sm text-neutral-500">Aucune donnée.</p> : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Régularité / dispersion</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      Nombre de semaines actives : <span className="font-semibold text-neutral-900">{weekBuckets.length}</span>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      Écart entre semaine record et semaine faible :{" "}
                      <span className="font-semibold text-neutral-900">
                        {activeWeekBuckets.length > 1
                          ? safeDuration(
                              Math.max(...activeWeekBuckets.map((week) => week.activeSeconds)) -
                                Math.min(...activeWeekBuckets.map((week) => week.activeSeconds)),
                            )
                          : "—"}
                      </span>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      Répartition globale : <span className="font-semibold text-neutral-900">{workShare >= 80 ? "stable côté travail" : "pauses importantes"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Temps moyen par session</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Global</span>
                      <span className="font-semibold text-neutral-900">{safeDuration(averageSessionSeconds)}</span>
                    </div>
                    {sectorBuckets.slice(0, 2).map((sector) => (
                      <div key={sector.sectorId} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        <span className="truncate">{sector.sectorName}</span>
                        <span className="shrink-0 font-semibold text-neutral-900">
                          {safeDuration(Math.floor(sector.activeSeconds / Math.max(1, sector.entryCount)))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Changements de tâche par jour</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="flex items-center justify-between rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Moyenne quotidienne</span>
                      <span className="font-semibold text-neutral-900">{formatDecimal(averageTaskChangesPerDay)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Jour le plus fragmenté</span>
                      <span className="text-right font-semibold text-neutral-900">
                        {mostFragmentedDay ? `${formatDateLong(mostFragmentedDay.date)} — ${mostFragmentedDay.changes}` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Jour le plus stable</span>
                      <span className="text-right font-semibold text-neutral-900">
                        {leastFragmentedDay ? `${formatDateLong(leastFragmentedDay.date)} — ${leastFragmentedDay.changes}` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Top actions</h2>
                  <div className="space-y-2">
                    {actionBuckets.slice(0, 5).map((action, index) => (
                      <div key={`${action.actionType}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-neutral-900">{action.actionType}</p>
                          <p className="mt-1 text-xs text-neutral-500">
                            Présente dans {action.entryCount} entrée{action.entryCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-neutral-900">{action.totalQuantity}</span>
                      </div>
                    ))}
                    {actionBuckets.length === 0 ? <p className="text-sm text-neutral-500">Aucune action associée aux entrées.</p> : null}
                  </div>
                </div>

                <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">Résumé de période</h2>
                  <div className="space-y-2 text-sm text-neutral-700">
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Entrées suivies</span>
                      <span className="font-semibold text-neutral-900">{filteredEntries.length}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Actions saisies</span>
                      <span className="font-semibold text-neutral-900">{totalActionQuantity}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-3 py-3 ring-1 ring-neutral-200">
                      <span>Période affichée</span>
                      <span className="font-semibold text-neutral-900">{getRangeLabel(range)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
