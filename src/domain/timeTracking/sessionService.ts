import { sessionRepository } from "../../repositories/sessionRepository";
import type { ActiveSession } from "../../types/domain";

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
};