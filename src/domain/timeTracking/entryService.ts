import { db } from "../../db/database";
import { actionRepository } from "../../repositories/actionRepository";
import type { EntryAction, Tag, TimeEntry } from "../../types/domain";

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

function normalizeActions(
  timeEntryId: string,
  actions: Array<{
    actionType: string;
    quantity: number;
  }>,
): EntryAction[] {
  return actions
    .map((action) => ({
      actionType: action.actionType.trim(),
      quantity: Number(action.quantity),
    }))
    .filter((action) => action.actionType && Number.isFinite(action.quantity) && action.quantity > 0)
    .map((action) => ({
      id: crypto.randomUUID(),
      timeEntryId,
      actionType: action.actionType,
      quantity: action.quantity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
}

export const entryService = {
  async createEntry(
    entry: TimeEntry,
    tagNames: string[] = [],
    actions: Array<{ actionType: string; quantity: number }> = [],
  ): Promise<string> {
    await db.timeEntries.put(entry);
    await syncTagsForEntry(entry.id, tagNames);

    const normalizedActions = normalizeActions(entry.id, actions);
    await actionRepository.replaceForEntry(entry.id, normalizedActions);

    return entry.id;
  },

  async createManualEntry(
    entry: TimeEntry,
    tagNames: string[] = [],
    actions: Array<{ actionType: string; quantity: number }> = [],
  ): Promise<string> {
    return this.createEntry(entry, tagNames, actions);
  },

  async updateEntry(
    entry: TimeEntry,
    tagNames: string[] = [],
    actions: Array<{ actionType: string; quantity: number }> = [],
  ): Promise<void> {
    await db.timeEntries.put(entry);
    await syncTagsForEntry(entry.id, tagNames);

    const normalizedActions = normalizeActions(entry.id, actions);
    await actionRepository.replaceForEntry(entry.id, normalizedActions);
  },

  async deleteEntry(id: string): Promise<void> {
    await db.timeEntryTags.where("timeEntryId").equals(id).delete();
    await actionRepository.deleteByEntryId(id);
    await db.timeEntries.delete(id);
  },
};