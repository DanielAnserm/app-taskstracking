import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { db } from "../db/database";
import type { Tag, TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
  tags?: Tag[];
}

interface DayBucket {
  date: string;
  label: string;
  shortLabel: string;
  entries: EntryWithSector[];
  activeSeconds: number;
  pauseSeconds: number;
}

interface SectorChartSlice {
  sectorId: string;
  name: string;
  seconds: number;
  color: string;
  percentage: number;
}

interface TaskGroup {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  totalSeconds: number;
  isPause: boolean;
}

type WeekViewMode = "list" | "calendar";

interface CalendarBlock {
  id: string;
  title: string;
  color: string;
  startMinutes: number;
  endMinutes: number;
  durationSeconds: number;
  isPause: boolean;
}

const CALENDAR_START_HOUR = 6;
const CALENDAR_END_HOUR = 22;
const CALENDAR_TOTAL_MINUTES = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sameDayKey(dateKey: string, entry: TimeEntry): boolean {
  return entry.date === dateKey;
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatShortDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-CA", {
    weekday: "short",
    day: "numeric",
  });
}

function formatRangeLabel(start: Date, end: Date): string {
  return `Du ${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")}`;
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

function isoToMinutes(iso: string): number {
  const date = new Date(iso);
  return date.getHours() * 60 + date.getMinutes();
}

function clampCalendarMinutes(minutes: number): number {
  const min = CALENDAR_START_HOUR * 60;
  const max = CALENDAR_END_HOUR * 60;
  return Math.min(Math.max(minutes, min), max);
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatEntryTimeRange(startAt: string, endAt: string): string {
  return `${new Date(startAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })} – ${new Date(endAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function WeeklyPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [availableSectors, setAvailableSectors] = useState<WorkSector[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFilterSectorId, setSelectedFilterSectorId] = useState("all");
  const [selectedFilterTagName, setSelectedFilterTagName] = useState("all");
  const [viewMode, setViewMode] = useState<WeekViewMode>("list");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      const rawEntries = await db.timeEntries.toArray();
      const allSectors = await db.workSectors.toArray();
      const allTags = await db.tags.toArray();

      const usableSectors = allSectors
        .filter((sector) => sector.isActive && !sector.isArchived && sector.id !== "pause")
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

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const weeklyEntries = useMemo(() => {
    const weekKeys = new Set(weekDays.map((day) => toDateKey(day)));

    return entries.filter((entry) => {
      const inWeek = weekKeys.has(entry.date);
      const sectorOk =
        selectedFilterSectorId === "all" || entry.sectorId === selectedFilterSectorId;
      const tagOk =
        selectedFilterTagName === "all" ||
        Boolean(entry.tags?.some((tag) => tag.name === selectedFilterTagName));

      return inWeek && sectorOk && tagOk;
    });
  }, [entries, weekDays, selectedFilterSectorId, selectedFilterTagName]);

  const buckets = useMemo<DayBucket[]>(() => {
    return weekDays.map((day) => {
      const dateKey = toDateKey(day);
      const dayEntries = weeklyEntries
        .filter((entry) => sameDayKey(dateKey, entry))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      const activeSeconds = dayEntries
        .filter((entry) => !entry.isPause)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);

      const pauseSeconds = dayEntries
        .filter((entry) => entry.isPause)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);

      return {
        date: dateKey,
        label: formatDayLabel(day),
        shortLabel: formatShortDayLabel(day),
        entries: dayEntries,
        activeSeconds,
        pauseSeconds,
      };
    });
  }, [weeklyEntries, weekDays]);

  const groupedBuckets = useMemo(() => {
    return buckets.map((day) => {
      const groupsMap = new Map<string, TaskGroup>();

      for (const entry of day.entries) {
        const key = entry.sectorId;
        const existing = groupsMap.get(key);

        if (existing) {
          existing.totalSeconds += entry.durationSeconds;
        } else {
          groupsMap.set(key, {
            sectorId: key,
            sectorName: entry.sector?.name ?? entry.sectorId,
            sectorColor: entry.sector?.color ?? (entry.isPause ? "#f59e0b" : "#737373"),
            totalSeconds: entry.durationSeconds,
            isPause: entry.isPause,
          });
        }
      }

      const groups = Array.from(groupsMap.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);

      return {
        ...day,
        groups,
      };
    });
  }, [buckets]);

  const calendarBuckets = useMemo(() => {
    return buckets.map((day) => {
      const blocks: CalendarBlock[] = day.entries
        .map((entry) => {
          const rawStart = isoToMinutes(entry.startAt);
          const rawEnd = isoToMinutes(entry.endAt);
          const startMinutes = clampCalendarMinutes(rawStart);
          const endMinutes = clampCalendarMinutes(rawEnd);

          if (endMinutes <= startMinutes) {
            return null;
          }

          return {
            id: entry.id,
            title: entry.sector?.name ?? entry.sectorId,
            color: entry.sector?.color ?? (entry.isPause ? "#f59e0b" : "#737373"),
            startMinutes,
            endMinutes,
            durationSeconds: entry.durationSeconds,
            isPause: entry.isPause,
          };
        })
        .filter(Boolean) as CalendarBlock[];

      return {
        ...day,
        blocks,
      };
    });
  }, [buckets]);

  const weekActiveSeconds = buckets.reduce((sum, day) => sum + day.activeSeconds, 0);
  const weekPauseSeconds = buckets.reduce((sum, day) => sum + day.pauseSeconds, 0);
  const totalWeekSeconds = weekActiveSeconds + weekPauseSeconds;
  const activeDays = buckets.filter((day) => day.entries.length > 0).length;
  const entryCount = weeklyEntries.length;

  const topSector = useMemo(() => {
    const map = new Map<string, { name: string; seconds: number }>();

    for (const entry of weeklyEntries) {
      if (entry.isPause) continue;

      const existing = map.get(entry.sectorId);
      if (existing) {
        existing.seconds += entry.durationSeconds;
      } else {
        map.set(entry.sectorId, {
          name: entry.sector?.name ?? entry.sectorId,
          seconds: entry.durationSeconds,
        });
      }
    }

    if (map.size === 0) {
      return { name: "—", seconds: 0 };
    }

    return Array.from(map.values()).sort((a, b) => b.seconds - a.seconds)[0];
  }, [weeklyEntries]);

  const sectorChartData = useMemo<SectorChartSlice[]>(() => {
    const map = new Map<string, { name: string; seconds: number; color: string }>();

    for (const entry of weeklyEntries) {
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

    if (map.size === 0 || totalWeekSeconds === 0) {
      return [];
    }

    return Array.from(map.entries())
      .map(([sectorId, item]) => ({
        sectorId,
        name: item.name,
        seconds: item.seconds,
        color: item.color,
        percentage: Math.round((item.seconds / totalWeekSeconds) * 1000) / 10,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [weeklyEntries, totalWeekSeconds]);

  const weekRangeLabel = formatRangeLabel(weekDays[0], weekDays[6]);

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
                Suivi hebdomadaire
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Vue synthétique de la semaine avec filtres, liste regroupée et calendrier.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:items-end">
              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Semaine actuelle
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                  className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  ←
                </button>

                <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm ring-1 ring-black/5">
                  {weekRangeLabel}
                </div>

                <button
                  type="button"
                  onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                  className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps actif</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(weekActiveSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps de pause</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(weekPauseSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Entrées de la semaine</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {entryCount}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Secteur principal</p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
              {topSector.name}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              {topSector.seconds > 0
                ? formatDurationFromSeconds(topSector.seconds)
                : "Aucun temps actif"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">Filtres</h2>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Tâches
                </label>
                <select
                  value={selectedFilterSectorId}
                  onChange={(e) => setSelectedFilterSectorId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
                >
                  <option value="all">Toutes les tâches</option>
                  {availableSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                  <option value="pause">Pause</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Tags
                </label>
                <select
                  value={selectedFilterTagName}
                  onChange={(e) => setSelectedFilterTagName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
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

          <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <h2 className="text-base font-semibold text-neutral-900">Vue / affichage</h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium ring-1 ${
                  viewMode === "list"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300"
                }`}
              >
                Vue liste
              </button>

              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium ring-1 ${
                  viewMode === "calendar"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300"
                }`}
              >
                Vue calendrier
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">
                {viewMode === "list" ? "Vue liste" : "Vue calendrier"}
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                {viewMode === "list"
                  ? "Chaque jour regroupe les tâches avec leur temps total."
                  : "Lecture hebdomadaire par blocs horaires, dans l’esprit d’un agenda."}
              </p>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : viewMode === "list" ? (
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {groupedBuckets.map((day) => (
                <section
                  key={day.date}
                  className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold capitalize text-neutral-900">
                        {day.label}
                      </h3>
                      <p className="mt-1 text-sm text-neutral-500">
                        Actif : {formatDurationFromSeconds(day.activeSeconds)}
                        {" · "}
                        Pause : {formatDurationFromSeconds(day.pauseSeconds)}
                      </p>
                    </div>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
                      {day.entries.length} entrée{day.entries.length > 1 ? "s" : ""}
                    </span>
                  </div>

                  {day.groups.length === 0 ? (
                    <p className="mt-4 text-sm text-neutral-500">Aucune entrée.</p>
                  ) : (
                    <div className="mt-4 space-y-2.5">
                      {day.groups.map((group) => (
                        <div
                          key={`${day.date}-${group.sectorId}`}
                          className="rounded-2xl bg-white p-3.5 ring-1 ring-black/5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: group.sectorColor }}
                              />
                              <p className="truncate text-sm font-semibold text-neutral-900">
                                {group.sectorName}
                              </p>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  group.isPause
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-neutral-100 text-neutral-700"
                                }`}
                              >
                                {group.isPause ? "Pause" : "Travail"}
                              </span>
                            </div>

                            <span
                              className="rounded-full px-2.5 py-1 text-xs font-semibold ring-1"
                              style={{
                                backgroundColor: hexToRgba(group.sectorColor, 0.12),
                                borderColor: hexToRgba(group.sectorColor, 0.25),
                                color: group.sectorColor,
                              }}
                            >
                              {formatDurationFromSeconds(group.totalSeconds)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <div className="min-w-[980px]">
                <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] gap-0">
                  <div />
                  {calendarBuckets.map((day) => (
                    <div
                      key={day.date}
                      className="border-b border-neutral-200 px-3 pb-3 text-center"
                    >
                      <p className="text-sm font-semibold capitalize text-neutral-900">
                        {day.shortLabel}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">
                        {formatDurationFromSeconds(day.activeSeconds + day.pauseSeconds)}
                      </p>
                    </div>
                  ))}

                  <div className="relative">
                    {Array.from(
                      { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
                      (_, index) => CALENDAR_START_HOUR + index,
                    ).map((hour, index) => (
                      <div
                        key={hour}
                        className="relative h-16 border-b border-neutral-200 pr-3 text-right"
                      >
                        {index < CALENDAR_END_HOUR - CALENDAR_START_HOUR ? (
                          <span className="-translate-y-2 inline-block text-xs text-neutral-500">
                            {formatHourLabel(hour)}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  {calendarBuckets.map((day) => (
                    <div key={day.date} className="relative border-l border-neutral-200">
                      {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => (
                        <div
                          key={`${day.date}-hour-${index}`}
                          className="h-16 border-b border-neutral-200"
                        />
                      ))}

                      <div className="absolute inset-0">
                        {day.blocks.map((block) => {
                          const top =
                            ((block.startMinutes - CALENDAR_START_HOUR * 60) / CALENDAR_TOTAL_MINUTES) *
                            100;
                          const height = Math.max(
                            ((block.endMinutes - block.startMinutes) / CALENDAR_TOTAL_MINUTES) * 100,
                            3,
                          );

                          return (
                            <div
                              key={block.id}
                              className="absolute left-1 right-1 overflow-hidden rounded-xl border px-2 py-1 shadow-sm"
                              style={{
                                top: `${top}%`,
                                height: `${height}%`,
                                backgroundColor: hexToRgba(block.color, block.isPause ? 0.18 : 0.14),
                                borderColor: hexToRgba(block.color, 0.35),
                                color: block.color,
                              }}
                              title={`${block.title} · ${formatDurationFromSeconds(
                                block.durationSeconds,
                              )}`}
                            >
                              <p className="truncate text-[11px] font-semibold">{block.title}</p>
                              <p className="truncate text-[10px] opacity-80">
                                {block.isPause ? "Pause" : "Travail"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
              Répartition de la semaine
            </h3>
            <p className="text-sm text-neutral-600">
              Temps total par tâche, pauses incluses.
            </p>
          </div>

          {sectorChartData.length === 0 ? (
            <p className="mt-5 text-sm text-neutral-600">
              Aucune donnée à afficher pour cette semaine.
            </p>
          ) : (
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
              <div className="mx-auto h-[340px] w-full max-w-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorChartData}
                      dataKey="seconds"
                      nameKey="name"
                      innerRadius={88}
                      outerRadius={128}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {sectorChartData.map((entry) => (
                        <Cell key={entry.sectorId} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none -mt-[205px] flex flex-col items-center justify-center text-center">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                    Total semaine
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                    {formatDurationFromSeconds(totalWeekSeconds)}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {activeDays} jour{activeDays > 1 ? "s" : ""} actif{activeDays > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {sectorChartData.map((item) => (
                  <div
                    key={item.sectorId}
                    className="rounded-xl bg-neutral-50 px-3 py-2.5 ring-1 ring-neutral-200"
                  >
                    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <p className="truncate text-sm font-medium text-neutral-900">
                        {item.name}
                      </p>
                      <p className="text-sm font-semibold text-neutral-900">
                        {formatDurationFromSeconds(item.seconds)}
                      </p>
                      <p className="text-xs text-neutral-500">{item.percentage} %</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}