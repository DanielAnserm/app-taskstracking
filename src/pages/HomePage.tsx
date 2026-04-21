import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { aggregationService } from "../domain/timeTracking/aggregationService";
import { sessionService } from "../domain/timeTracking/sessionService";
import { db } from "../db/database";
import type { ActiveSession, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HomePage() {
  const [currentSession, setCurrentSession] = useState<ActiveSession | undefined>(undefined);
  const [currentSector, setCurrentSector] = useState<WorkSector | undefined>(undefined);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const session = await sessionService.getCurrent();
      const totals = await aggregationService.getDailyTotals(todayDateString());

      let sector: WorkSector | undefined;
      if (session) {
        sector = await db.workSectors.get(session.sectorId);
      }

      if (!cancelled) {
        setCurrentSession(session);
        setCurrentSector(sector);
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
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Outil de suivi du temps de travail
          </h1>
          <p className="text-sm text-neutral-600">
            Premier socle dynamique branché sur les données locales.
          </p>
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Tâche active</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Vue centrale pendant une tâche en cours.
              </p>
            </div>

            {currentSession?.status ? (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                {currentSession.status === "running" ? "En cours" : currentSession.status}
              </span>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : currentSession ? (
            <div className="mt-5 rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: currentSector?.color ?? "#737373" }}
                    />
                    <p className="text-lg font-semibold text-neutral-900">
                      {currentSector?.name ?? currentSession.sectorId}
                    </p>
                  </div>

                  <p className="mt-2 text-sm text-neutral-600">
                    Commencée à{" "}
                    {new Date(currentSession.startedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>

                  {currentSession.notesDraft ? (
                    <p className="mt-3 text-sm text-neutral-700">{currentSession.notesDraft}</p>
                  ) : null}
                </div>

                <div className="shrink-0 rounded-2xl bg-white px-4 py-3 ring-1 ring-neutral-200">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Énergie
                  </p>
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    {currentSession.energy ?? "Non définie"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
              <p className="text-sm text-neutral-600">Aucune tâche active.</p>
            </div>
          )}
        </section>

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
          <h2 className="text-xl font-semibold text-neutral-900">Navigation</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Accès rapide aux premières vues de la V1.
          </p>

          <nav className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/jour"
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
            >
              Suivi du jour
            </Link>
            <Link
              to="/historique"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Historique
            </Link>
            <Link
              to="/parametres"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Paramètres
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}