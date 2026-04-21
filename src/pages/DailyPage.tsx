import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { aggregationService } from "../domain/timeTracking/aggregationService";
import { db } from "../db/database";
import { timeEntryRepository } from "../repositories/timeEntryRepository";
import type { TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
}

export function DailyPage() {
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const date = todayDateString();
      const rawEntries = await timeEntryRepository.listByDate(date);
      const totals = await aggregationService.getDailyTotals(date);

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
        setActiveSeconds(totals.activeSeconds);
        setPauseSeconds(totals.pauseSeconds);
        setLoading(false);
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              to="/"
              className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
            >
              Retour à l’accueil
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              Suivi du jour
            </h1>
            <p className="mt-1 text-sm text-neutral-600">
              Lecture simple des entrées enregistrées aujourd’hui.
            </p>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps actif</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(activeSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps de pause</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(pauseSeconds)}
            </p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-neutral-900">Entrées du jour</h2>
            {!loading && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {entries.length} entrée{entries.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : entries.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">Aucune entrée aujourd’hui.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {entries.map((entry) => {
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor: entry.sector?.color ?? (isPause ? "#f59e0b" : "#737373"),
                            }}
                          />
                          <p className="text-base font-semibold text-neutral-900">
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
                          <p className="mt-3 text-sm text-neutral-700">{entry.notes}</p>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-lg font-semibold text-neutral-900">
                          {formatDurationFromSeconds(entry.durationSeconds)}
                        </p>
                        <p
                          className={`mt-1 text-sm font-medium ${
                            isPause ? "text-amber-700" : "text-neutral-500"
                          }`}
                        >
                          {isPause ? "Pause" : "Travail"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}