import { db } from "./database";
import type { ActiveSession, TimeEntry, WorkSector } from "../types/domain";

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function seedDemoData(): Promise<void> {
  const existingSectors = await db.workSectors.count();
  const existingEntries = await db.timeEntries.count();
  const existingSessions = await db.activeSessions.count();

  if (existingSectors > 0 || existingEntries > 0 || existingSessions > 0) {
    return;
  }

  const now = new Date();
  const today = todayDateString();

  const sectors: WorkSector[] = [
    {
      id: "reunions",
      name: "Réunions",
      color: "#3b82f6",
      icon: "users",
      displayOrder: 1,
      isActive: true,
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "admin",
      name: "Admin",
      color: "#78716c",
      icon: "folder",
      displayOrder: 2,
      isActive: true,
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "mails",
      name: "Mails",
      color: "#06b6d4",
      icon: "mail",
      displayOrder: 3,
      isActive: true,
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "pause",
      name: "Pause",
      color: "#f59e0b",
      icon: "pause",
      displayOrder: 999,
      isActive: true,
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const entries: TimeEntry[] = [
    {
      id: crypto.randomUUID(),
      date: today,
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0).toISOString(),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 15).toISOString(),
      durationSeconds: 75 * 60,
      sectorId: "reunions",
      subTaskId: undefined,
      energy: "bon",
      notes: "Point équipe",
      source: "manual",
      isPause: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: crypto.randomUUID(),
      date: today,
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 15).toISOString(),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30).toISOString(),
      durationSeconds: 15 * 60,
      sectorId: "pause",
      subTaskId: undefined,
      energy: undefined,
      notes: undefined,
      source: "manual",
      isPause: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: crypto.randomUUID(),
      date: today,
      startAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30).toISOString(),
      endAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 20).toISOString(),
      durationSeconds: 50 * 60,
      sectorId: "mails",
      subTaskId: undefined,
      energy: "moyen",
      notes: "Traitement des réponses",
      source: "manual",
      isPause: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const activeSession: ActiveSession = {
    id: crypto.randomUUID(),
    sectorId: "admin",
    subTaskId: undefined,
    startedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 30).toISOString(),
    status: "running",
    pausedAt: undefined,
    accumulatedPauseSeconds: 0,
    energy: "bon",
    notesDraft: "Classement et suivi",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  await db.workSectors.bulkAdd(sectors);
  await db.timeEntries.bulkAdd(entries);
  await db.activeSessions.add(activeSession);
}