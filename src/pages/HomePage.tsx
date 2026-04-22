import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { aggregationService } from "../domain/timeTracking/aggregationService";
import { sessionService } from "../domain/timeTracking/sessionService";
import { db } from "../db/database";
import type { ActiveSession, WorkSector } from "../types/domain";
import { formatDurationFromSeconds, formatTimer } from "../utils/duration";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeElapsedSeconds(session: ActiveSession, nowMs: number): number {
  const base = session.accumulatedActiveSeconds ?? 0;

  if (session.status === "running") {
    const segmentStart = session.segmentStartedAt ?? session.startedAt;
    const runningSeconds = Math.max(
      0,
      Math.floor((nowMs - new Date(segmentStart).getTime()) / 1000),
    );
    return base + runningSeconds;
  }

  return base;
}

export function HomePage() {
  const [currentSession, setCurrentSession] = useState<ActiveSession | undefined>(undefined);
  const [currentSector, setCurrentSector] = useState<WorkSector | undefined>(undefined);
  const [availableSectors, setAvailableSectors] = useState<WorkSector[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState("");
  const [draftNote, setDraftNote] = useState("");

  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [clockMs, setClockMs] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState(false);

  async function loadData() {
    const session = await sessionService.getCurrent();
    const totals = await aggregationService.getDailyTotals(todayDateString());

    const allSectors = await db.workSectors.toArray();
    const usableSectors = allSectors
      .filter((sector) => sector.isActive && !sector.isArchived && sector.id !== "pause")
      .sort((a, b) => a.displayOrder - b.displayOrder);

    let sector: WorkSector | undefined;
    if (session) {
      sector = await db.workSectors.get(session.sectorId);
    }

    setCurrentSession(session);
    setCurrentSector(sector);
    setAvailableSectors(usableSectors);
    setActiveSeconds(totals.activeSeconds);
    setPauseSeconds(totals.pauseSeconds);

    if (!selectedSectorId && usableSectors.length > 0) {
      setSelectedSectorId(usableSectors[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const elapsedSeconds = useMemo(() => {
    if (!currentSession) return 0;
    return computeElapsedSeconds(currentSession, clockMs);
  }, [currentSession, clockMs]);

  async function handlePause() {
    if (!currentSession) return;
    setActionLoading(true);
    try {
      await sessionService.pause(currentSession);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResume() {
    if (!currentSession) return;
    setActionLoading(true);
    try {
      await sessionService.resume(currentSession);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    if (!currentSession) return;
    setActionLoading(true);
    try {
      await sessionService.stop(currentSession);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartTask() {
    if (!selectedSectorId) return;

    setActionLoading(true);
    try {
      const now = new Date().toISOString();

      const newSession: ActiveSession = {
        id: crypto.randomUUID(),
        sectorId: selectedSectorId,
        subTaskId: undefined,
        startedAt: now,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: 0,
        accumulatedActiveSeconds: 0,
        segmentStartedAt: now,
        energy: "bon",
        notesDraft: draftNote.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      await sessionService.start(newSession);
      setDraftNote("");
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartPause() {
    setActionLoading(true);
    try {
      const now = new Date().toISOString();

      const pauseSession: ActiveSession = {
        id: crypto.randomUUID(),
        sectorId: "pause",
        subTaskId: undefined,
        startedAt: now,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: 0,
        accumulatedActiveSeconds: 0,
        segmentStartedAt: now,
        energy: undefined,
        notesDraft: draftNote.trim() || "Pause",
        createdAt: now,
        updatedAt: now,
      };

      await sessionService.start(pauseSession);
      setDraftNote("");
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  const isPauseSession = currentSession?.sectorId === "pause";

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
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
                  isPauseSession
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : currentSession.status === "running"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200"
                }`}
              >
                {isPauseSession
                  ? "Pause en cours"
                  : currentSession.status === "running"
                    ? "En cours"
                    : "En pause"}
              </span>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : currentSession ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                      <p className="mt-3 text-sm text-neutral-700">
                        {currentSession.notesDraft}
                      </p>
                    ) : null}
                  </div>

                  <div className="shrink-0 space-y-3">
                    <div className="rounded-2xl bg-white px-5 py-4 text-center ring-1 ring-neutral-200">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        {isPauseSession ? "Temps de pause" : "Temps actif cumulé"}
                      </p>
                      <p className="mt-2 text-4xl font-bold tracking-tight text-neutral-900">
                        {formatTimer(elapsedSeconds)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-neutral-200">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Énergie
                      </p>
                      <p className="mt-1 text-sm font-semibold text-neutral-900">
                        {currentSession.energy ?? "Non définie"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {!isPauseSession ? (
                  <>
                    {currentSession.status === "running" ? (
                      <button
                        type="button"
                        onClick={handlePause}
                        disabled={actionLoading}
                        className="rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 ring-1 ring-amber-200 disabled:opacity-50"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResume}
                        disabled={actionLoading}
                        className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200 disabled:opacity-50"
                      >
                        Reprendre
                      </button>
                    )}
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 disabled:opacity-50"
                >
                  {isPauseSession ? "Terminer la pause" : "Arrêter"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
              <p className="text-sm text-neutral-700">
                Aucune tâche active. Démarre une nouvelle tâche ci-dessous.
              </p>

              {availableSectors.length === 0 ? (
                <p className="mt-4 text-sm text-amber-700">
                  Aucun secteur disponible. Il faudra en créer dans Paramètres.
                </p>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr]">
                  <div>
                    <label
                      htmlFor="sector"
                      className="mb-2 block text-sm font-medium text-neutral-700"
                    >
                      Secteur
                    </label>
                    <select
                      id="sector"
                      value={selectedSectorId}
                      onChange={(e) => setSelectedSectorId(e.target.value)}
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none ring-0"
                    >
                      {availableSectors.map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="note"
                      className="mb-2 block text-sm font-medium text-neutral-700"
                    >
                      Note
                    </label>
                    <input
                      id="note"
                      type="text"
                      value={draftNote}
                      onChange={(e) => setDraftNote(e.target.value)}
                      placeholder="Ex. classement, suivi, appels..."
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none ring-0"
                    />
                  </div>
                </div>
              )}

              {availableSectors.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleStartTask}
                    disabled={actionLoading || !selectedSectorId}
                    className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Démarrer
                  </button>

                  <button
                    type="button"
                    onClick={handleStartPause}
                    disabled={actionLoading}
                    className="rounded-full bg-amber-100 px-5 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200 disabled:opacity-50"
                  >
                    Commencer une pause
                  </button>
                </div>
              ) : null}
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
    to="/hebdo"
    className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
  >
    Suivi hebdo
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