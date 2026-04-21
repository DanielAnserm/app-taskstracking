import type { ActiveSession, EntryAction, Tag, TimeEntry } from "./domain";

export interface TimeEntryDetailed extends TimeEntry {
  sectorName: string;
  sectorColor: string;
  subTaskName?: string;
  tags: Tag[];
  actions: EntryAction[];
}

export interface ActiveSessionDetailed extends ActiveSession {
  sectorName: string;
  sectorColor: string;
  subTaskName?: string;
  elapsedSeconds: number;
}

export interface DailyTotals {
  activeSeconds: number;
  pauseSeconds: number;
  totalSeconds: number;
  entryCount: number;
}