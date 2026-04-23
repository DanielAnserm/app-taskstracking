import { db } from "../db/database";
import type { EntryAction } from "../types/domain";

export const actionRepository = {
  async create(action: EntryAction): Promise<string> {
    await db.entryActions.put(action);
    return action.id;
  },

  async bulkCreate(actions: EntryAction[]): Promise<void> {
    if (actions.length === 0) return;
    await db.entryActions.bulkPut(actions);
  },

  async update(action: EntryAction): Promise<void> {
    await db.entryActions.put(action);
  },

  async delete(id: string): Promise<void> {
    await db.entryActions.delete(id);
  },

  async deleteByEntryId(timeEntryId: string): Promise<void> {
    await db.entryActions.where("timeEntryId").equals(timeEntryId).delete();
  },

  async listByEntryId(timeEntryId: string): Promise<EntryAction[]> {
    return db.entryActions.where("timeEntryId").equals(timeEntryId).toArray();
  },

  async replaceForEntry(timeEntryId: string, actions: EntryAction[]): Promise<void> {
    await db.entryActions.where("timeEntryId").equals(timeEntryId).delete();

    if (actions.length === 0) return;

    await db.entryActions.bulkPut(actions);
  },
};