export type EnergyLevel = "faible" | "moyen" | "bon" | "excellent";
export type EntrySource = "live" | "manual" | "imported";
export type SessionStatus = "running" | "paused" | "stopped";

export interface WorkSector {
  id: string;
  name: string;
  color: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubTask {
  id: string;
  sectorId: string;
  name: string;
  defaultActionType?: string;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  sectorId: string;
  subTaskId?: string;
  energy?: EnergyLevel;
  notes?: string;
  source: EntrySource;
  isPause: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryTag {
  id: string;
  timeEntryId: string;
  tagId: string;
}

export interface EntryAction {
  id: string;
  timeEntryId: string;
  actionType: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  id: string;
  sectorId: string;
  subTaskId?: string;
  startedAt: string;
  status: SessionStatus;
  pausedAt?: string;
  accumulatedPauseSeconds: number;
  accumulatedActiveSeconds: number;
  segmentStartedAt: string;
  energy?: EnergyLevel;
  notesDraft?: string;
  tagNamesDraft?: string[];
  createdAt: string;
  updatedAt: string;
}