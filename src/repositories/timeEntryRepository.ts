import { db } from "../db/database";
import type { TimeEntry } from "../types/domain";

export const timeEntryRepository = {
  async create(entry: TimeEntry): Promise<string> {
    await db.timeEntries.put(entry);
    return entry.id;
  },

  async update(entry: TimeEntry): Promise<void> {
    await db.timeEntries.put(entry);
  },

  async remove(id: string): Promise<void> {
    await db.timeEntries.delete(id);
  },

  async getById(id: string): Promise<TimeEntry | undefined> {
    return db.timeEntries.get(id);
  },

  async listByDate(date: string): Promise<TimeEntry[]> {
    return db.timeEntries.where("date").equals(date).sortBy("startAt");
  },

  async listPauseEntriesByDate(date: string): Promise<TimeEntry[]> {
    const entries = await db.timeEntries.where("date").equals(date).sortBy("startAt");
    return entries.filter((entry) => entry.isPause);
  },
};