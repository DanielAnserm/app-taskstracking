import { db } from "../db/database";
import type { ActiveSession } from "../types/domain";

export const sessionRepository = {
  async getCurrent(): Promise<ActiveSession | undefined> {
    const running = await db.activeSessions.where("status").equals("running").first();
    if (running) return running;

    return db.activeSessions.where("status").equals("paused").first();
  },

  async save(session: ActiveSession): Promise<void> {
    await db.activeSessions.put(session);
  },

  async remove(id: string): Promise<void> {
    await db.activeSessions.delete(id);
  },

  async clearAll(): Promise<void> {
    await db.activeSessions.clear();
  },
};