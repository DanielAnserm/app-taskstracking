import { db } from "../db/database";
import type { Tag } from "../types/domain";

export const tagRepository = {
  async listAll(): Promise<Tag[]> {
    const tags = await db.tags.toArray();
    return tags.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  },

  async create(tag: Tag): Promise<string> {
    await db.tags.put(tag);
    return tag.id;
  },

  async update(tag: Tag): Promise<void> {
    await db.tags.put(tag);
  },

  async archive(id: string): Promise<void> {
    const tag = await db.tags.get(id);
    if (!tag) return;

    await db.tags.put({
      ...tag,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  },

  async unarchive(id: string): Promise<void> {
    const tag = await db.tags.get(id);
    if (!tag) return;

    await db.tags.put({
      ...tag,
      isArchived: false,
      updatedAt: new Date().toISOString(),
    });
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const tag = await db.tags.get(id);
    if (!tag) return;

    await db.tags.put({
      ...tag,
      isActive,
      updatedAt: new Date().toISOString(),
    });
  },
};