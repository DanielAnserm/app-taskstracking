import Dexie, { type Table } from "dexie";
import type {
  ActiveSession,
  EntryAction,
  SubTask,
  Tag,
  TimeEntry,
  TimeEntryTag,
  WorkSector,
} from "../types/domain";

export class TimeTrackingDatabase extends Dexie {
  workSectors!: Table<WorkSector, string>;
  subTasks!: Table<SubTask, string>;
  tags!: Table<Tag, string>;
  timeEntries!: Table<TimeEntry, string>;
  timeEntryTags!: Table<TimeEntryTag, string>;
  entryActions!: Table<EntryAction, string>;
  activeSessions!: Table<ActiveSession, string>;

  constructor() {
    super("time_tracking_v1");

    this.version(1).stores({
      workSectors: "id, name, displayOrder, isActive, isArchived",
      subTasks: "id, sectorId, name, displayOrder, isActive, isArchived",
      tags: "id, name, isActive, isArchived",
      timeEntries:
        "id, date, startAt, endAt, sectorId, subTaskId, isPause, source, [date+sectorId], [date+isPause]",
      timeEntryTags: "id, timeEntryId, tagId, [timeEntryId+tagId]",
      entryActions: "id, timeEntryId, actionType",
      activeSessions: "id, status, startedAt, sectorId, subTaskId",
    });
  }
}

export const db = new TimeTrackingDatabase();