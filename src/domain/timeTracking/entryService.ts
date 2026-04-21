import { timeEntryRepository } from "../../repositories/timeEntryRepository";
import type { TimeEntry } from "../../types/domain";

export const entryService = {
  async createManualEntry(entry: TimeEntry): Promise<string> {
    return timeEntryRepository.create(entry);
  },

  async updateEntry(entry: TimeEntry): Promise<void> {
    await timeEntryRepository.update(entry);
  },

  async deleteEntry(id: string): Promise<void> {
    await timeEntryRepository.remove(id);
  },
};