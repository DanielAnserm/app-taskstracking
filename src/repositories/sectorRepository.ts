import { db } from "../db/database";
import type { WorkSector } from "../types/domain";

export const sectorRepository = {
  async listAll(): Promise<WorkSector[]> {
    const sectors = await db.workSectors.toArray();
    return sectors.sort((a, b) => a.displayOrder - b.displayOrder);
  },

  async getById(id: string): Promise<WorkSector | undefined> {
    return db.workSectors.get(id);
  },

  async create(sector: WorkSector): Promise<string> {
    await db.workSectors.put(sector);
    return sector.id;
  },

  async update(sector: WorkSector): Promise<void> {
    await db.workSectors.put(sector);
  },

  async archive(id: string): Promise<void> {
    const sector = await db.workSectors.get(id);
    if (!sector) return;

    await db.workSectors.put({
      ...sector,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  },

  async unarchive(id: string): Promise<void> {
    const sector = await db.workSectors.get(id);
    if (!sector) return;

    await db.workSectors.put({
      ...sector,
      isArchived: false,
      updatedAt: new Date().toISOString(),
    });
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const sector = await db.workSectors.get(id);
    if (!sector) return;

    await db.workSectors.put({
      ...sector,
      isActive,
      updatedAt: new Date().toISOString(),
    });
  },
};