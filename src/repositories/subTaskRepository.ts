import { db } from "../db/database";
import type { SubTask } from "../types/domain";

export const subTaskRepository = {
  async listAll(): Promise<SubTask[]> {
    const subTasks = await db.subTasks.toArray();
    return subTasks.sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async listBySector(sectorId: string): Promise<SubTask[]> {
    const subTasks = await db.subTasks.where("sectorId").equals(sectorId).toArray();
    return subTasks.sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async create(subTask: SubTask): Promise<string> {
    await db.subTasks.put(subTask);
    return subTask.id;
  },

  async update(subTask: SubTask): Promise<void> {
    await db.subTasks.put(subTask);
  },

  async archive(id: string): Promise<void> {
    const subTask = await db.subTasks.get(id);
    if (!subTask) return;

    await db.subTasks.put({
      ...subTask,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  },

  async unarchive(id: string): Promise<void> {
    const subTask = await db.subTasks.get(id);
    if (!subTask) return;

    await db.subTasks.put({
      ...subTask,
      isArchived: false,
      updatedAt: new Date().toISOString(),
    });
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const subTask = await db.subTasks.get(id);
    if (!subTask) return;

    await db.subTasks.put({
      ...subTask,
      isActive,
      updatedAt: new Date().toISOString(),
    });
  },

  async getOrCreateByName(sectorId: string, name: string): Promise<SubTask> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Le nom de la sous-tâche est vide.");
    }

    const existingSubTasks = await db.subTasks.where("sectorId").equals(sectorId).toArray();

    const existing = existingSubTasks.find(
      (subTask) => subTask.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const nextDisplayOrder =
      existingSubTasks.length > 0
        ? Math.max(...existingSubTasks.map((subTask) => subTask.displayOrder)) + 1
        : 1;

    const newSubTask: SubTask = {
      id: crypto.randomUUID(),
      sectorId,
      name: trimmedName,
      defaultActionType: undefined,
      displayOrder: nextDisplayOrder,
      isActive: true,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.subTasks.put(newSubTask);
    return newSubTask;
  },
};