import type { DailyTotals } from "../../types/dto";
import { timeEntryRepository } from "../../repositories/timeEntryRepository";

export const aggregationService = {
  async getDailyTotals(date: string): Promise<DailyTotals> {
    const entries = await timeEntryRepository.listByDate(date);

    const activeSeconds = entries
      .filter((entry) => !entry.isPause)
      .reduce((sum, entry) => sum + entry.durationSeconds, 0);

    const pauseSeconds = entries
      .filter((entry) => entry.isPause)
      .reduce((sum, entry) => sum + entry.durationSeconds, 0);

    return {
      activeSeconds,
      pauseSeconds,
      totalSeconds: activeSeconds + pauseSeconds,
      entryCount: entries.length,
    };
  },
};