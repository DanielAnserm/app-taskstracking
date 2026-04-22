import { entryService } from "./entryService";
import { sessionRepository } from "../../repositories/sessionRepository";
import type { ActiveSession, SessionStatus, TimeEntry } from "../../types/domain";

function dateFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function diffSeconds(startIso: string, endIso: string): number {
  return Math.max(
    0,
    Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000),
  );
}

function buildEntry(params: {
  sectorId: string;
  startAt: string;
  endAt: string;
  isPause: boolean;
  notes?: string;
  energy?: ActiveSession["energy"];
}): TimeEntry {
  const nowIso = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    date: dateFromIso(params.startAt),
    startAt: params.startAt,
    endAt: params.endAt,
    durationSeconds: diffSeconds(params.startAt, params.endAt),
    sectorId: params.sectorId,
    subTaskId: undefined,
    energy: params.isPause ? undefined : params.energy,
    notes: params.notes,
    source: "live",
    isPause: params.isPause,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export const sessionService = {
  async ensureNoOtherActiveSession(): Promise<void> {
    const current = await sessionRepository.getCurrent();
    if (current) {
      throw new Error("Une session est déjà active.");
    }
  },

  async start(session: ActiveSession): Promise<void> {
    await this.ensureNoOtherActiveSession();
    await sessionRepository.save(session);
  },

  async getCurrent(): Promise<ActiveSession | undefined> {
    return sessionRepository.getCurrent();
  },

  async clearCurrent(id: string): Promise<void> {
    await sessionRepository.remove(id);
  },

  async update(session: ActiveSession): Promise<void> {
    await sessionRepository.save(session);
  },

  async setStatus(session: ActiveSession, status: SessionStatus): Promise<void> {
    const nowIso = new Date().toISOString();

    if (status === "paused") {
      const segmentStart = session.segmentStartedAt ?? session.startedAt;
      const workedSeconds = diffSeconds(segmentStart, nowIso);

      if (workedSeconds > 0) {
  await entryService.createEntry(
    buildEntry({
      sectorId: session.sectorId,
      startAt: segmentStart,
      endAt: nowIso,
      isPause: false,
      notes: session.notesDraft,
      energy: session.energy,
    }),
    session.tagNamesDraft ?? [],
  );
}
      await sessionRepository.save({
        ...session,
        status: "paused",
        pausedAt: nowIso,
        accumulatedActiveSeconds: (session.accumulatedActiveSeconds ?? 0) + workedSeconds,
        updatedAt: nowIso,
      });
      return;
    }

    if (status === "running") {
      if (!session.pausedAt) {
        await sessionRepository.save({
          ...session,
          status: "running",
          updatedAt: nowIso,
        });
        return;
      }

      const pauseSeconds = diffSeconds(session.pausedAt, nowIso);

      if (pauseSeconds > 0) {
  await entryService.createEntry(
    buildEntry({
      sectorId: "pause",
      startAt: session.pausedAt,
      endAt: nowIso,
      isPause: true,
    }),
    [],
  );
}

      await sessionRepository.save({
        ...session,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: (session.accumulatedPauseSeconds ?? 0) + pauseSeconds,
        segmentStartedAt: nowIso,
        updatedAt: nowIso,
      });
      return;
    }

    await sessionRepository.save({
      ...session,
      status,
      updatedAt: nowIso,
    });
  },

  async pause(session: ActiveSession): Promise<void> {
    if (session.status !== "running") return;
    if (session.sectorId === "pause") return;
    await this.setStatus(session, "paused");
  },

  async resume(session: ActiveSession): Promise<void> {
    if (session.status !== "paused") return;
    await this.setStatus(session, "running");
  },

  async stop(session: ActiveSession): Promise<void> {
    const nowIso = new Date().toISOString();

    if (session.status === "running") {
      const segmentStart = session.segmentStartedAt ?? session.startedAt;
      const segmentSeconds = diffSeconds(segmentStart, nowIso);
      const isPauseSession = session.sectorId === "pause";

      if (segmentSeconds > 0) {
  await entryService.createEntry(
    buildEntry({
      sectorId: isPauseSession ? "pause" : session.sectorId,
      startAt: segmentStart,
      endAt: nowIso,
      isPause: isPauseSession,
      notes: session.notesDraft,
      energy: isPauseSession ? undefined : session.energy,
    }),
    isPauseSession ? [] : session.tagNamesDraft ?? [],
  );
}
    }

    await sessionRepository.remove(session.id);
  },
};