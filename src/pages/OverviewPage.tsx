import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/database";
import type { Tag, TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
  tags?: Tag[];
}

type RangeKey = "7d" | "30d" | "90d";

interface WeekdayBucket {
  key: number;
  label: string;
  activeSeconds: number;
  pauseSeconds: number;
}

interface SectorBucket {
  sectorId: string;
  sectorName: string;
  color: string;
  activeSeconds: number;
}

interface TagBucket {
  tagId: string;
  tagName: string;
  activeSeconds: number;
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

function startDateForRange(range: RangeKey): Date {
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
  return "90 derniers jours";
}

export function OverviewPage() {
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      const rawEntries = await db.timeEntries.toArray();
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
      .filter((entry) => new Date(entry.startAt) >= start)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [entries, range]);

  const activeEntries = filteredEntries.filter((entry) => !entry.isPause);
  const pauseEntries = filteredEntries.filter((entry) => entry.isPause);

  const totalActiveSeconds = activeEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );
  const totalPauseSeconds = pauseEntries.reduce(
    (sum, entry) => sum + entry.durationSeconds,
    0,
  );

  const activeDays = new Set(filteredEntries.map((entry) => entry.date)).size;

  const weekdayBuckets = useMemo<WeekdayBucket[]>(() => {
    const buckets: WeekdayBucket[] = Array.from({ length: 7 }, (_, day) => ({
      key: day,
      label: weekdayLabel(day),
      activeSeconds: 0,
      pauseSeconds: 0,
    }));

    for (const entry of filteredEntries) {
      const day = new Date(entry.startAt).getDay();
      if (entry.isPause) {
        buckets[day].pauseSeconds += entry.durationSeconds;
      } else {
        buckets[day].activeSeconds += entry.durationSeconds;
      }
    }

    return buckets.sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [filteredEntries]);

  const sectorBuckets = useMemo<SectorBucket[]>(() => {
    const map = new Map<string, SectorBucket>();

    for (const entry of activeEntries) {
      const key = entry.sectorId;
      const existing = map.get(key);

      if (existing) {
        existing.activeSeconds += entry.durationSeconds;
      } else {
        map.set(key, {
          sectorId: key,
          sectorName: entry.sector?.name ?? key,
          color: entry.sector?.color ?? "#737373",
          activeSeconds: entry.durationSeconds,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activeEntries]);

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

    for (const entry of filteredEntries) {
      const existing = map.get(entry.date);

      if (existing) {
        if (entry.isPause) {
          existing.pauseSeconds += entry.durationSeconds;
        } else {
          existing.activeSeconds += entry.durationSeconds;
        }
        existing.entryCount += 1;
      } else {
        map.set(entry.date, {
          date: entry.date,
          activeSeconds: entry.isPause ? 0 : entry.durationSeconds,
          pauseSeconds: entry.isPause ? entry.durationSeconds : 0,
          entryCount: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [filteredEntries]);

  const hourBuckets = useMemo<HourBucket[]>(() => {
    const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      label: hourLabel(hour),
      activeSeconds: 0,
      pauseSeconds: 0,
    }));

    for (const entry of filteredEntries) {
      const hour = new Date(entry.startAt).getHours();
      if (entry.isPause) {
        buckets[hour].pauseSeconds += entry.durationSeconds;
      } else {
        buckets[hour].activeSeconds += entry.durationSeconds;
      }
    }

    return buckets;
  }, [filteredEntries]);

  const topProductiveHours = useMemo(() => {
    return [...hourBuckets]
      .filter((bucket) => bucket.activeSeconds > 0)
      .sort((a, b) => b.activeSeconds - a.activeSeconds)
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

  const workShare =
    totalActiveSeconds + totalPauseSeconds > 0
      ? Math.round((totalActiveSeconds / (totalActiveSeconds + totalPauseSeconds)) * 100)
      : 0;

  const pauseShare =
    totalActiveSeconds + totalPauseSeconds > 0 ? 100 - workShare : 0;

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <Link
            to="/"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            Retour à l’accueil
          </Link>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
                Vue globale
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Consolidation réelle des entrées sur une période.
              </p>
            </div>

            <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm ring-1 ring-black/5">
              {getRangeLabel(range)}
            </div>
          </div>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setRange("7d")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                range === "7d"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              7 jours
            </button>
            <button
              type="button"
              onClick={() => setRange("30d")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                range === "30d"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              30 jours
            </button>
            <button
              type="button"
              onClick={() => setRange("90d")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                range === "90d"
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              90 jours
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps actif</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(totalActiveSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps de pause</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(totalPauseSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Entrées</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {filteredEntries.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Jours actifs</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {activeDays}
            </p>
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <p className="text-sm text-neutral-600">Chargement…</p>
          </section>
        ) : (
          <>
            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Répartition travail / pause
                </h2>

                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-neutral-600">
                      <span>Travail</span>
                      <span>{workShare}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full bg-neutral-900 transition-all"
                        style={{ width: `${workShare}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-neutral-600">
                      <span>Pause</span>
                      <span>{pauseShare}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: `${pauseShare}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Indicateurs complémentaires
                </h2>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                    <p className="text-sm font-medium text-neutral-500">Temps moyen par session</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                      {formatDurationFromSeconds(averageSessionSeconds)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                    <p className="text-sm font-medium text-neutral-500">
                      Changements de tâche / jour
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                      {averageTaskChangesPerDay.toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Jours les plus productifs
                </h2>

                {productiveDays.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-600">
                    Aucun jour actif sur cette période.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {productiveDays.slice(0, 3).map((day, index) => (
                      <div
                        key={day.date}
                        className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                                #{index + 1}
                              </span>
                              <p className="font-semibold text-neutral-900">
                                {new Date(`${day.date}T12:00:00`).toLocaleDateString("fr-CA", {
                                  weekday: "long",
                                  day: "numeric",
                                  month: "long",
                                })}
                              </p>
                            </div>
                            <p className="mt-2 text-sm text-neutral-500">
                              Pause : {formatDurationFromSeconds(day.pauseSeconds)} · Entrées :{" "}
                              {day.entryCount}
                            </p>
                          </div>

                          <p className="shrink-0 font-semibold text-neutral-900">
                            {formatDurationFromSeconds(day.activeSeconds)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Périodes les plus productives
                </h2>

                {topProductiveHours.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-600">
                    Aucune plage horaire active sur cette période.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {topProductiveHours.map((bucket, index) => (
                      <div
                        key={bucket.hour}
                        className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                                #{index + 1}
                              </span>
                              <p className="font-semibold text-neutral-900">{bucket.label}</p>
                            </div>
                            <p className="mt-2 text-sm text-neutral-500">
                              Pause : {formatDurationFromSeconds(bucket.pauseSeconds)}
                            </p>
                          </div>

                          <p className="shrink-0 font-semibold text-neutral-900">
                            {formatDurationFromSeconds(bucket.activeSeconds)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-3">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 xl:col-span-1">
                <h2 className="text-xl font-semibold text-neutral-900">
                  Répartition par jour de la semaine
                </h2>

                <div className="mt-5 space-y-3">
                  {weekdayBuckets.map((day) => (
                    <div
                      key={day.key}
                      className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-neutral-900">{day.label}</p>
                          <p className="mt-1 text-sm text-neutral-500">
                            Pause : {formatDurationFromSeconds(day.pauseSeconds)}
                          </p>
                        </div>
                        <p className="font-semibold text-neutral-900">
                          {formatDurationFromSeconds(day.activeSeconds)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 xl:col-span-1">
                <h2 className="text-xl font-semibold text-neutral-900">Top secteurs</h2>

                {sectorBuckets.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-600">
                    Aucun secteur de travail sur cette période.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {sectorBuckets.map((sector, index) => (
                      <div
                        key={sector.sectorId}
                        className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                              #{index + 1}
                            </span>
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: sector.color }}
                            />
                            <p className="font-semibold text-neutral-900">
                              {sector.sectorName}
                            </p>
                          </div>
                          <p className="font-semibold text-neutral-900">
                            {formatDurationFromSeconds(sector.activeSeconds)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 xl:col-span-1">
                <h2 className="text-xl font-semibold text-neutral-900">Top tags</h2>

                {tagBuckets.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-600">
                    Aucun tag associé aux entrées de travail sur cette période.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {tagBuckets.map((tag, index) => (
                      <div
                        key={tag.tagId}
                        className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white">
                              #{index + 1}
                            </span>
                            <p className="font-semibold text-neutral-900">{tag.tagName}</p>
                          </div>
                          <p className="font-semibold text-neutral-900">
                            {formatDurationFromSeconds(tag.activeSeconds)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}