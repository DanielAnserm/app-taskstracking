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
};