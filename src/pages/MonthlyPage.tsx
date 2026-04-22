import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/database";
import type { TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
}

interface WeekBucket {
  key: string;
  label: string;
  entries: EntryWithSector[];
  activeSeconds: number;
  pauseSeconds: number;
}

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

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  return `${weekStart.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  })} → ${weekEnd.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
  })}`;
}

export function MonthlyPage() {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);

      const rawEntries = await db.timeEntries.toArray();
      const enrichedEntries = await Promise.all(
        rawEntries.map(async (entry) => {
          const sector = await db.workSectors.get(entry.sectorId);
          return {
            ...entry,
            sector,
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

  const monthStart = useMemo(() => startOfMonth(monthDate), [monthDate]);
  const monthEnd = useMemo(() => endOfMonth(monthDate), [monthDate]);

  const monthlyEntries = useMemo(() => {
    return entries
      .filter((entry) => {
        const entryDate = new Date(entry.startAt);
        return entryDate >= monthStart && entryDate <= monthEnd;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [entries, monthStart, monthEnd]);

  const monthActiveSeconds = monthlyEntries
    .filter((entry) => !entry.isPause)
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);

  const monthPauseSeconds = monthlyEntries
    .filter((entry) => entry.isPause)
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);

  const activeDays = new Set(monthlyEntries.map((entry) => entry.date)).size;
  const averagePerActiveDay =
    activeDays > 0 ? Math.floor(monthActiveSeconds / activeDays) : 0;

  const weeklyBuckets = useMemo<WeekBucket[]>(() => {
    const map = new Map<string, WeekBucket>();

    for (const entry of monthlyEntries) {
      const weekStart = getWeekStart(new Date(entry.startAt));
      const key = toDateKey(weekStart);

      if (!map.has(key)) {
        map.set(key, {
          key,
          label: getWeekLabel(weekStart),
          entries: [],
          activeSeconds: 0,
          pauseSeconds: 0,
        });
      }

      const bucket = map.get(key)!;
      bucket.entries.push(entry);

      if (entry.isPause) {
        bucket.pauseSeconds += entry.durationSeconds;
      } else {
        bucket.activeSeconds += entry.durationSeconds;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [monthlyEntries]);

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-4">
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
              Vue simple du mois basée sur les vraies entrées enregistrées.
            </p>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMonthDate((prev) => addMonths(prev, -1))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Mois précédent
              </button>

              <button
                type="button"
                onClick={() => setMonthDate(startOfMonth(new Date()))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Mois actuel
              </button>

              <button
                type="button"
                onClick={() => setMonthDate((prev) => addMonths(prev, 1))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Mois suivant
              </button>
            </div>

            <p className="text-sm font-medium text-neutral-600">
              {monthDate.toLocaleDateString("fr-CA", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps actif</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(monthActiveSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps de pause</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(monthPauseSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Jours actifs</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {activeDays}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Moyenne journalière</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(averagePerActiveDay)}
            </p>
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <p className="text-sm text-neutral-600">Chargement…</p>
          </section>
        ) : weeklyBuckets.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <p className="text-sm text-neutral-600">Aucune entrée ce mois-ci.</p>
          </section>
        ) : (
          <section className="space-y-4">
            {weeklyBuckets.map((week) => (
              <div
                key={week.key}
                className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">
                      Semaine du {week.label}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      {week.entries.length} entrée{week.entries.length > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="text-sm text-neutral-600">
                    Actif : {formatDurationFromSeconds(week.activeSeconds)} · Pause :{" "}
                    {formatDurationFromSeconds(week.pauseSeconds)}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {week.entries.map((entry) => {
                    const isPause = entry.isPause;

                    return (
                      <div
                        key={entry.id}
                        className={`rounded-2xl p-4 ring-1 ${
                          isPause
                            ? "bg-amber-50 ring-amber-200"
                            : "bg-neutral-50 ring-neutral-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    entry.sector?.color ?? (isPause ? "#f59e0b" : "#737373"),
                                }}
                              />
                              <p className="font-semibold text-neutral-900">
                                {entry.sector?.name ?? entry.sectorId}
                              </p>
                            </div>

                            <p className="mt-1 text-sm text-neutral-600">
                              {new Date(entry.startAt).toLocaleDateString("fr-CA", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                              })}
                              {" · "}
                              {new Date(entry.startAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" – "}
                              {new Date(entry.endAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>

                            {entry.notes ? (
                              <p className="mt-2 text-sm text-neutral-700">{entry.notes}</p>
                            ) : null}
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="font-semibold text-neutral-900">
                              {formatDurationFromSeconds(entry.durationSeconds)}
                            </p>
                            <p className="mt-1 text-sm text-neutral-500">
                              {isPause ? "Pause" : "Travail"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}