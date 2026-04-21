import { sessionRepository } from "../../repositories/sessionRepository";
import type { ActiveSession, SessionStatus } from "../../types/domain";

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
    const now = new Date().toISOString();

    if (status === "paused") {
      await sessionRepository.save({
        ...session,
        status: "paused",
        pausedAt: now,
        updatedAt: now,
      });
      return;
    }

    if (status === "running") {
      let accumulatedPauseSeconds = session.accumulatedPauseSeconds;

      if (session.pausedAt) {
        const pauseStartedAt = new Date(session.pausedAt).getTime();
        const resumedAt = new Date(now).getTime();
        accumulatedPauseSeconds += Math.max(
          0,
          Math.floor((resumedAt - pauseStartedAt) / 1000),
        );
      }

      await sessionRepository.save({
        ...session,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds,
        updatedAt: now,
      });
      return;
    }

    await sessionRepository.save({
      ...session,
      status,
      updatedAt: now,
    });
  },

  async pause(session: ActiveSession): Promise<void> {
    if (session.status !== "running") return;
    await this.setStatus(session, "paused");
  },

  async resume(session: ActiveSession): Promise<void> {
    if (session.status !== "paused") return;
    await this.setStatus(session, "running");
  },

  async stop(session: ActiveSession): Promise<void> {
    await sessionRepository.remove(session.id);
  },
};