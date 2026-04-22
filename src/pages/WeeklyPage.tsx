import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/database";
import type { TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
}

interface DayBucket {
  date: string;
  label: string;
  entries: EntryWithSector[];
  activeSeconds: number;
  pauseSeconds: number;
}

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

export function WeeklyPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
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

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const buckets = useMemo<DayBucket[]>(() => {
    return weekDays.map((day) => {
      const dateKey = toDateKey(day);
      const dayEntries = entries
        .filter((entry) => sameDayKey(dateKey, entry))
        .sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        );

      const activeSeconds = dayEntries
        .filter((entry) => !entry.isPause)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);

      const pauseSeconds = dayEntries
        .filter((entry) => entry.isPause)
        .reduce((sum, entry) => sum + entry.durationSeconds, 0);

      return {
        date: dateKey,
        label: formatDayLabel(day),
        entries: dayEntries,
        activeSeconds,
        pauseSeconds,
      };
    });
  }, [entries, weekDays]);

  const weekActiveSeconds = buckets.reduce((sum, day) => sum + day.activeSeconds, 0);
  const weekPauseSeconds = buckets.reduce((sum, day) => sum + day.pauseSeconds, 0);
  const activeDays = buckets.filter((day) => day.entries.length > 0).length;

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
              Suivi hebdomadaire
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Vue simple de la semaine basée sur les vraies entrées enregistrées.
            </p>
          </div>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Semaine précédente
              </button>

              <button
                type="button"
                onClick={() => setWeekStart(startOfWeek(new Date()))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Semaine actuelle
              </button>

              <button
                type="button"
                onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Semaine suivante
              </button>
            </div>

            <p className="text-sm font-medium text-neutral-600">
              Du {weekDays[0].toLocaleDateString("fr-CA")} au{" "}
              {weekDays[6].toLocaleDateString("fr-CA")}
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
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
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {buckets.map((day) => (
              <div
                key={day.date}
                className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
              >
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-neutral-900 capitalize">
                    {day.label}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    Actif : {formatDurationFromSeconds(day.activeSeconds)}
                  </p>
                  <p className="text-sm text-neutral-500">
                    Pause : {formatDurationFromSeconds(day.pauseSeconds)}
                  </p>
                </div>

                {day.entries.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-500">Aucune entrée.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {day.entries.map((entry) => {
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
                                      entry.sector?.color ??
                                      (isPause ? "#f59e0b" : "#737373"),
                                  }}
                                />
                                <p className="font-semibold text-neutral-900">
                                  {entry.sector?.name ?? entry.sectorId}
                                </p>
                              </div>

                              <p className="mt-1 text-sm text-neutral-600">
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
                                <p className="mt-2 text-sm text-neutral-700">
                                  {entry.notes}
                                </p>
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
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}