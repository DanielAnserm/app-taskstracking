import { db } from "../../db/database";
import type { Tag, TimeEntry } from "../../types/domain";

function normalizeTagNames(tagNames: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const rawName of tagNames) {
    const trimmed = rawName.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

async function ensureTagIds(tagNames: string[]): Promise<string[]> {
  const normalizedNames = normalizeTagNames(tagNames);
  if (normalizedNames.length === 0) return [];

  const existingTags = await db.tags.toArray();
  const existingMap = new Map(existingTags.map((tag) => [tag.name.toLowerCase(), tag]));

  const nowIso = new Date().toISOString();
  const tagIds: string[] = [];

  for (const name of normalizedNames) {
    const existing = existingMap.get(name.toLowerCase());

    if (existing) {
      tagIds.push(existing.id);
      continue;
    }

    const newTag: Tag = {
      id: crypto.randomUUID(),
      name,
      color: undefined,
      description: undefined,
      isActive: true,
      isArchived: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.tags.put(newTag);
    existingMap.set(name.toLowerCase(), newTag);
    tagIds.push(newTag.id);
  }

  return tagIds;
}

async function syncTagsForEntry(entryId: string, tagNames: string[]): Promise<void> {
  const tagIds = await ensureTagIds(tagNames);

  await db.timeEntryTags.where("timeEntryId").equals(entryId).delete();

  if (tagIds.length === 0) return;

  const links = tagIds.map((tagId) => ({
    id: crypto.randomUUID(),
    timeEntryId: entryId,
    tagId,
  }));

  await db.timeEntryTags.bulkPut(links);
}

export const entryService = {
  async createEntry(entry: TimeEntry, tagNames: string[] = []): Promise<string> {
    await db.timeEntries.put(entry);
    await syncTagsForEntry(entry.id, tagNames);
    return entry.id;
  },

  async createManualEntry(entry: TimeEntry, tagNames: string[] = []): Promise<string> {
    return this.createEntry(entry, tagNames);
  },

  async updateEntry(entry: TimeEntry, tagNames: string[] = []): Promise<void> {
    await db.timeEntries.put(entry);
    await syncTagsForEntry(entry.id, tagNames);
  },

  async deleteEntry(id: string): Promise<void> {
    await db.timeEntryTags.where("timeEntryId").equals(id).delete();
    await db.timeEntries.delete(id);
  },
};