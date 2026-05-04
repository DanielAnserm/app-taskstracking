import { type ChangeEvent, useEffect, useState } from "react";
import PageHeaderNav from "../components/PageHeaderNav";
import { sectorRepository } from "../repositories/sectorRepository";
import { subTaskRepository } from "../repositories/subTaskRepository";
import { tagRepository } from "../repositories/tagRepository";
import { db } from "../db/database";
import type { SubTask, Tag, WorkSector } from "../types/domain";

interface DraftSector {
  name: string;
  color: string;
}

interface DraftTag {
  name: string;
}
interface DraftSubTask {
  sectorId: string;
  name: string;
}

interface ImportCsvRow {
  importKey: string;
  originalId: string;
  date: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  type: string;
  isPause: boolean;
  sectorName: string;
  subTaskName: string;
  tagNames: string[];
  notes: string;
  actions: Array<{ actionType: string; quantity: number }>;
  isDuplicate: boolean;
  errors: string[];
}

interface ImportPreview {
  fileName: string;
  rows: ImportCsvRow[];
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  importableRows: number;
  sectorsToCreate: string[];
  subTasksToCreate: Array<{ sectorName: string; subTaskName: string }>;
  tagsToCreate: string[];
}

type ExportRange = "all" | "currentWeek" | "currentMonth" | "custom";

interface ExportDateRange {
  startDate: string;
  endDate: string;
  label: string;
}

interface ExportDataRow {
  importKey: string;
  id: string;
  date: string;
  startAt: string;
  endAt: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  durationLabel: string;
  type: string;
  isPause: boolean;
  sectorName: string;
  subTaskName: string;
  tagNames: string[];
  tagsLabel: string;
  notes: string;
  actionsLabel: string;
}

interface ExportData {
  rows: ExportDataRow[];
  rangeLabel: string;
  totalSeconds: number;
  workSeconds: number;
  pauseSeconds: number;
}

interface JsonImportPreview {
  fileName: string;
  backup: unknown;
  errors: string[];
  workSectorsCount: number;
  subTasksCount: number;
  tagsCount: number;
  timeEntriesCount: number;
  timeEntryTagsCount: number;
  entryActionsCount: number;
  activeSessionsCount: number;
  newWorkSectorsCount: number;
  newSubTasksCount: number;
  newTagsCount: number;
  newTimeEntriesCount: number;
  newTimeEntryTagsCount: number;
  newEntryActionsCount: number;
  newActiveSessionsCount: number;
}

interface TodoistTargetOption {
  id: string;
  label: string;
}

interface TodoistImportTask {
  importKey: string;
  date: string;
  dayLabel: string;
  completedAt: string;
  completedTimeLabel: string;
  title: string;
  projectName: string;
  selected: boolean;
  targetTimeEntryId: string;
  targetOptions: TodoistTargetOption[];
  importProjectAsTag: boolean;
  suggestedTagName: string;
  isDuplicate: boolean;
  duplicateMode: TodoistDuplicateMode;
  errors: string[];
}

interface TodoistImportPreview {
  fileName: string;
  tasks: TodoistImportTask[];
  totalTasks: number;
}

type TodoistDuplicateMode = "ignore" | "add" | "replace";

type TodoistNoteBuildResult = {
  lines: string[];
  actionQuantity: number;
  removedExistingLines: string[];
};

type DataJournalType =
  | "export_csv"
  | "export_markdown"
  | "export_prompt"
  | "export_json"
  | "import_csv"
  | "import_json"
  | "import_todoist";

interface DataJournalEntry {
  id: string;
  type: DataJournalType;
  title: string;
  description: string;
  detail?: string;
  createdAt: string;
}

type WeekStartsOn = 0 | 1;

interface StatisticsCalculationSettings {
  daysOff: number[];
  excludedTagIds: string[];
  nonWorkingDayThresholdMinutes: number;
  weekStartsOn: WeekStartsOn;
}

const STATISTICS_SETTINGS_STORAGE_KEY = "time-tracking-statistics-settings";
const LEGACY_STATISTICS_SETTINGS_STORAGE_KEY = "time-tracking-statistics-settings-v1";

const DEFAULT_STATISTICS_SETTINGS: StatisticsCalculationSettings = {
  daysOff: [5, 6],
  excludedTagIds: [],
  nonWorkingDayThresholdMinutes: 60,
  weekStartsOn: 1,
};

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

const WEEK_START_OPTIONS: Array<{ value: WeekStartsOn; label: string; description: string }> = [
  { value: 1, label: "Lundi", description: "Semaine du lundi au dimanche" },
  { value: 0, label: "Dimanche", description: "Semaine du dimanche au samedi" },
];

function loadStatisticsCalculationSettings(): StatisticsCalculationSettings {
  try {
    const rawSettings =
      localStorage.getItem(STATISTICS_SETTINGS_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_STATISTICS_SETTINGS_STORAGE_KEY);

    if (!rawSettings) return DEFAULT_STATISTICS_SETTINGS;

    const parsedSettings = JSON.parse(rawSettings) as Partial<
      StatisticsCalculationSettings & { excludedWeekDays?: number[] }
    >;

    const rawDaysOff = Array.isArray(parsedSettings.daysOff)
      ? parsedSettings.daysOff
      : parsedSettings.excludedWeekDays;

    return {
      daysOff: Array.isArray(rawDaysOff)
        ? rawDaysOff.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        : DEFAULT_STATISTICS_SETTINGS.daysOff,
      excludedTagIds: Array.isArray(parsedSettings.excludedTagIds)
        ? parsedSettings.excludedTagIds.filter((tagId) => typeof tagId === "string")
        : DEFAULT_STATISTICS_SETTINGS.excludedTagIds,
      nonWorkingDayThresholdMinutes:
        typeof parsedSettings.nonWorkingDayThresholdMinutes === "number" &&
          Number.isFinite(parsedSettings.nonWorkingDayThresholdMinutes)
          ? Math.max(0, Math.round(parsedSettings.nonWorkingDayThresholdMinutes))
          : DEFAULT_STATISTICS_SETTINGS.nonWorkingDayThresholdMinutes,
      weekStartsOn:
        parsedSettings.weekStartsOn === 0 || parsedSettings.weekStartsOn === 1
          ? parsedSettings.weekStartsOn
          : DEFAULT_STATISTICS_SETTINGS.weekStartsOn,
    };
  } catch {
    return DEFAULT_STATISTICS_SETTINGS;
  }
}

function saveStatisticsCalculationSettings(settings: StatisticsCalculationSettings) {
  const storedSettings = {
    ...settings,
    excludedWeekDays: settings.daysOff,
  };

  localStorage.setItem(STATISTICS_SETTINGS_STORAGE_KEY, JSON.stringify(storedSettings));
  localStorage.setItem(LEGACY_STATISTICS_SETTINGS_STORAGE_KEY, JSON.stringify(storedSettings));
}

type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return "";

  const text = String(value).replace(/\r?\n|\r/g, " ");

  if (text.includes(",") || text.includes('"') || text.includes(";")) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatCsvDurationFromSeconds(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

function getTimeLabel(isoDate: string | undefined): string {
  if (!isoDate) return "";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("fr-CA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

function getCurrentMonthRange(): ExportDateRange {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
    label: start.toLocaleDateString("fr-CA", { month: "long", year: "numeric" }),
  };
}

function getCurrentWeekRange(): ExportDateRange {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startDate: toDateInputValue(monday),
    endDate: toDateInputValue(sunday),
    label: `Semaine du ${formatDateShort(monday)} au ${formatDateShort(sunday)}`,
  };
}

function formatDateLabel(dateString: string): string {
  const date = new Date(`${dateString}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isDateInRange(date: string, range: ExportDateRange | null): boolean {
  if (!range) return true;
  return date >= range.startDate && date <= range.endDate;
}

function safeArrayFromBackup(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function readBackupTables(backup: unknown): Record<string, unknown> {
  if (!backup || typeof backup !== "object") return {};

  const maybeBackup = backup as { tables?: unknown };
  if (!maybeBackup.tables || typeof maybeBackup.tables !== "object") return {};

  return maybeBackup.tables as Record<string, unknown>;
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function normalizeForKey(value: CsvValue): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function buildImportKey(params: {
  date: string;
  startAt: string;
  endAt: string;
  type: string;
  sectorName: string;
  subTaskName: string;
}): string {
  return [
    params.date,
    params.startAt,
    params.endAt,
    normalizeForKey(params.type),
    normalizeForKey(params.sectorName),
    normalizeForKey(params.subTaskName),
  ].join("|");
}

function detectCsvSeparator(text: string): "," | ";" {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  let commaCount = 0;
  let semicolonCount = 0;
  let inQuotes = false;

  for (let index = 0; index < firstLine.length; index += 1) {
    const char = firstLine[index];
    const nextChar = firstLine[index + 1];

    if (char === '"' && nextChar === '"') {
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ",") commaCount += 1;
    if (!inQuotes && char === ";") semicolonCount += 1;
  }

  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsv(text: string): string[][] {
  const separator = detectCsvSeparator(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const nextChar = cleanText[index + 1];

    if (char === '"' && nextChar === '"') {
      currentValue += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === separator) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      if (currentRow.some((value) => value.trim() !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  if (currentRow.some((value) => value.trim() !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

function normalizeHeader(header: string): string {
  return normalizeForKey(header).replace(/\s+/g, "_");
}

function csvRowsToObjects(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((row) => {
    const object: Record<string, string> = {};
    headers.forEach((header, index) => {
      object[header] = row[index]?.trim() ?? "";
    });
    return object;
  });
}

function parseIsoFromCsv(row: Record<string, string>, isoKey: string, timeKey: string): string {
  const isoValue = row[isoKey]?.trim();
  if (isoValue) return isoValue;

  const date = row.date?.trim();
  const time = row[timeKey]?.trim();
  if (!date || !time) return "";

  return `${date}T${time}:00`;
}

function parseTagsFromCsv(value: string): string[] {
  return value
    .split("|")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseActionsFromCsv(value: string): Array<{ actionType: string; quantity: number }> {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [rawType, rawQuantity] = part.split(":");
      const actionType = rawType?.trim() ?? "";
      const quantity = Number(rawQuantity?.trim() ?? "1");
      return { actionType, quantity };
    })
    .filter((action) => action.actionType && Number.isFinite(action.quantity) && action.quantity > 0);
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([`\uFEFF${csvContent}`], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

const DATA_JOURNAL_STORAGE_KEY = "outil-suivi-temps-data-journal";
const MAX_DATA_JOURNAL_ENTRIES = 12;

function loadDataJournalEntries(): DataJournalEntry[] {
  try {
    const rawValue = window.localStorage.getItem(DATA_JOURNAL_STORAGE_KEY);
    if (!rawValue) return [];

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [];

    return parsedValue
      .filter((entry): entry is DataJournalEntry => {
        return (
          entry &&
          typeof entry === "object" &&
          typeof entry.id === "string" &&
          typeof entry.type === "string" &&
          typeof entry.title === "string" &&
          typeof entry.description === "string" &&
          typeof entry.createdAt === "string"
        );
      })
      .slice(0, MAX_DATA_JOURNAL_ENTRIES);
  } catch {
    return [];
  }
}

function saveDataJournalEntries(entries: DataJournalEntry[]) {
  window.localStorage.setItem(
    DATA_JOURNAL_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_DATA_JOURNAL_ENTRIES)),
  );
}

function formatJournalDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;

  return date.toLocaleString("fr-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TODOIST_MONTHS: Record<string, number> = {
  jan: 0,
  janv: 0,
  janvier: 0,
  feb: 1,
  fev: 1,
  fév: 1,
  fevr: 1,
  févr: 1,
  fevrier: 1,
  février: 1,
  mar: 2,
  mars: 2,
  apr: 3,
  avr: 3,
  avril: 3,
  may: 4,
  mai: 4,
  jun: 5,
  juin: 5,
  jul: 6,
  juil: 6,
  juillet: 6,
  aug: 7,
  aout: 7,
  août: 7,
  sep: 8,
  sept: 8,
  septembre: 8,
  oct: 9,
  octobre: 9,
  nov: 10,
  novembre: 10,
  dec: 11,
  déc: 11,
  decembre: 11,
  décembre: 11,
};

function parseTodoistTimeToMinutes(timeText: string): number | null {
  const match = timeText.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function minutesToTimeLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildTodoistImportKey(params: {
  date: string;
  completedTimeLabel: string;
  title: string;
  projectName: string;
}): string {
  return [
    "todoist",
    params.date,
    params.completedTimeLabel,
    normalizeForKey(params.title),
    normalizeForKey(params.projectName),
  ].join("|");
}

function buildTodoistNoteLine(task: Pick<TodoistImportTask, "title">): string {
  const title = task.title.trim();
  return title ? `- ${title}` : "";
}

function getBirthdayMessageName(title: string): string | null {
  const match = title
    .trim()
    .match(/^(?:e|é|è|ê|ë|É|È|Ê|Ë)crire\s+(?:a|à)\s+(.+?)\s+pour\s+sa\s+f(?:e|ê)te$/i);
  if (!match) return null;

  const name = match[1]?.trim();
  return name || null;
}

function buildTodoistNoteLines(tasks: TodoistImportTask[], groupSimilarTasks: boolean): TodoistNoteBuildResult {
  const normalLines: string[] = [];
  const birthdayTasks: TodoistImportTask[] = [];
  const removedExistingLines: string[] = [];

  for (const task of tasks) {
    const title = buildTodoistNoteLine(task);
    if (!title) continue;

    const birthdayName = getBirthdayMessageName(task.title);
    if (groupSimilarTasks && birthdayName) {
      birthdayTasks.push(task);
      removedExistingLines.push(title);
      continue;
    }

    normalLines.push(title);
    removedExistingLines.push(title);
  }

  if (birthdayTasks.length > 0) {
    const birthdayLine = `- Écrire à ${birthdayTasks.length} personne${birthdayTasks.length > 1 ? "s" : ""} pour leur fête`;
    normalLines.push(birthdayLine);
    removedExistingLines.push(birthdayLine);
  }

  return {
    lines: Array.from(new Set(normalLines.map((line) => line.trim()).filter(Boolean))),
    actionQuantity: tasks.length,
    removedExistingLines: Array.from(new Set(removedExistingLines.map((line) => line.trim()).filter(Boolean))),
  };
}

function extractTodoistTitleFromNoteLine(line: string): string {
  let cleanedLine = line.trim();

  cleanedLine = cleanedLine.replace(/^Todoist\s*:\s*/i, "").trim();
  cleanedLine = cleanedLine.replace(/^-\s+/, "").trim();
  cleanedLine = cleanedLine.replace(/^\d{1,2}:\d{2}\s*(?:AM|PM)?\s*[—–-]\s*/i, "").trim();
  cleanedLine = cleanedLine.replace(/\s+·\s+.+$/, "").trim();

  return cleanedLine;
}

function isGroupedBirthdayTodoistLine(line: string): boolean {
  return /^ecrire a \d+ personnes? pour leur fete$/.test(normalizeForKey(extractTodoistTitleFromNoteLine(line)));
}

function isSameTodoistNoteLine(line: string, expectedLine: string): boolean {
  const cleanedLine = extractTodoistTitleFromNoteLine(line);
  const cleanedExpected = extractTodoistTitleFromNoteLine(expectedLine);
  const normalizedLine = normalizeForKey(cleanedLine);
  const normalizedExpected = normalizeForKey(cleanedExpected);

  if (!normalizedLine || !normalizedExpected) return false;
  if (normalizedLine === normalizedExpected) return true;

  if (/^ecrire a \d+ personnes? pour leur fete$/.test(normalizedExpected)) {
    return /^ecrire a \d+ personnes? pour leur fete$/.test(normalizedLine);
  }

  return false;
}

function notesContainTodoistTask(notes: string | undefined, task: Pick<TodoistImportTask, "title">): boolean {
  if (!notes) return false;

  const expectedLine = buildTodoistNoteLine(task);
  const normalizedExpectedTitle = normalizeForKey(task.title);
  const isBirthdayTask = Boolean(getBirthdayMessageName(task.title));

  return notes.split(/\r?\n/).some((line) => {
    if (isSameTodoistNoteLine(line, expectedLine)) return true;
    if (isBirthdayTask && isGroupedBirthdayTodoistLine(line)) return true;

    const normalizedLine = normalizeForKey(extractTodoistTitleFromNoteLine(line));
    return normalizedExpectedTitle.length > 8 && normalizedLine.includes(normalizedExpectedTitle);
  });
}

function removeTodoistLinesFromNotes(currentNotes: string | undefined, linesToRemove: string[]): string | undefined {
  if (!currentNotes) return currentNotes;

  const filteredLines = currentNotes.split(/\r?\n/).filter((line) => {
    return !linesToRemove.some((lineToRemove) => isSameTodoistNoteLine(line, lineToRemove));
  });

  const compactLines: string[] = [];
  for (const line of filteredLines) {
    const isBlank = line.trim() === "";
    const previousIsBlank = compactLines[compactLines.length - 1]?.trim() === "";
    if (isBlank && previousIsBlank) continue;
    compactLines.push(line);
  }

  return compactLines.join("\n").trim() || undefined;
}

function appendTodoistLinesToNotes(currentNotes: string | undefined, lines: string[], duplicateMode: TodoistDuplicateMode): string {
  const existingNotes = currentNotes?.trim() ?? "";
  const cleanedLines = Array.from(new Set(lines.map((line) => line.trim()).filter(Boolean)));

  const linesToAdd = duplicateMode === "add"
    ? cleanedLines
    : cleanedLines.filter((line) => !existingNotes.split(/\r?\n/).some((existingLine) => isSameTodoistNoteLine(existingLine, line)));

  if (linesToAdd.length === 0) return existingNotes;

  return existingNotes ? `${existingNotes}\n${linesToAdd.join("\n")}` : linesToAdd.join("\n");
}

function shouldImportTodoistProjectAsTag(projectName: string): boolean {
  const normalizedProject = normalizeForKey(projectName);

  if (!normalizedProject) return false;
  if (normalizedProject === "boite de reception") return false;
  if (normalizedProject === "inbox") return false;

  return true;
}

function inferTodoistSectorNames(task: Pick<TodoistImportTask, "title" | "projectName">): string[] {
  const title = normalizeForKey(task.title);
  const projectName = normalizeForKey(task.projectName);
  const combined = `${title} ${projectName}`;
  const sectors: string[] = [];

  if (/\b(courriel|courriels|mail|mails|email|emails)\b/.test(combined)) sectors.push("Mails");
  if (/\b(appel|appels|appeler|rappeler|telephone|telephoner)\b/.test(combined)) sectors.push("Appels");
  if (/\b(ecrire|message|messages|sms|whatsapp)\b/.test(combined)) sectors.push("Messages");
  if (/\b(suivi|suivis|leader|leaders|benevole|benevoles|bienvenue)\b/.test(combined)) sectors.push("Suivis");
  if (/\b(planif|planning|planifier|preparer|preparation)\b/.test(combined)) sectors.push("Planif bénévoles");
  if (/\b(admin|administratif|facture|factures|devis)\b/.test(combined)) sectors.push("Admin");
  if (/\b(reunion|reunions|rencontre|rencontres|responsables)\b/.test(combined)) sectors.push("Réunions");

  return Array.from(new Set(sectors));
}

function sanitizeLegacyTodoistNotes(notes: string | undefined): { notes: string | undefined; changed: boolean } {
  if (!notes) return { notes, changed: false };

  let changed = false;
  const cleanedLines: string[] = [];

  for (const rawLine of notes.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (normalizeForKey(line) === "todoist :" || normalizeForKey(line) === "todoist") {
      changed = true;
      continue;
    }

    const legacyMatch = line.match(/^-\s+\d{1,2}:\d{2}\s+—\s+(.+?)(?:\s+·\s+.+)?$/);
    if (legacyMatch) {
      const titleOnly = legacyMatch[1].trim();
      if (titleOnly) cleanedLines.push(titleOnly);
      changed = true;
      continue;
    }

    cleanedLines.push(rawLine);
  }

  const compactLines: string[] = [];
  for (const line of cleanedLines) {
    const isBlank = line.trim() === "";
    const previousIsBlank = compactLines[compactLines.length - 1]?.trim() === "";
    if (isBlank && previousIsBlank) continue;
    compactLines.push(line);
  }

  const nextNotes = compactLines.join("\n").trim() || undefined;
  return { notes: nextNotes, changed };
}

function readTodoistReportYear(fileName: string): number {
  const yearFromFileName = fileName.match(/(20\d{2})/)?.[1];
  const parsedYear = Number(yearFromFileName);
  if (Number.isFinite(parsedYear)) return parsedYear;

  return new Date().getFullYear();
}

function parseTodoistReportMarkdown(fileName: string, markdown: string) {
  const fallbackYear = readTodoistReportYear(fileName);
  const tasks: Array<{
    date: string;
    dayLabel: string;
    completedAt: string;
    completedTimeLabel: string;
    title: string;
    projectName: string;
    importKey: string;
  }> = [];

  let currentDate = "";
  let currentDayLabel = "";

  for (const line of markdown.split(/\r?\n/)) {
    const dayMatch = line.match(/^##\s+(.+?)\s+(?:‧|·|-)\s+(.+)$/);
    if (dayMatch) {
      const rawDate = dayMatch[1].trim();
      currentDayLabel = dayMatch[2].trim();

      const dateMatch = rawDate.match(/^([A-Za-zÀ-ÿ.]+)\s+(\d{1,2})(?:,?\s*(\d{4}))?$/);
      if (dateMatch) {
        const monthKey = normalizeForKey(dateMatch[1].replace(/\./g, ""));
        const month = TODOIST_MONTHS[monthKey];
        const day = Number(dateMatch[2]);
        const year = Number(dateMatch[3] ?? fallbackYear);

        if (month !== undefined && Number.isFinite(day) && Number.isFinite(year)) {
          currentDate = toDateInputValue(new Date(year, month, day));
        } else {
          currentDate = "";
        }
      } else {
        currentDate = "";
      }

      continue;
    }

    const taskMatch = line.match(/^-\s+(.+?)\s+—\s+Vous avez achevé\s+"(.+?)"(?:\s+·\s+(.+))?$/);
    if (!taskMatch || !currentDate) continue;

    const timeText = taskMatch[1].trim();
    const minutes = parseTodoistTimeToMinutes(timeText);
    if (minutes === null) continue;

    const completedTimeLabel = minutesToTimeLabel(minutes);
    const title = taskMatch[2].trim();
    const projectName = taskMatch[3]?.trim() ?? "";
    const completedAt = `${currentDate}T${completedTimeLabel}:00`;
    const importKey = buildTodoistImportKey({
      date: currentDate,
      completedTimeLabel,
      title,
      projectName,
    });

    tasks.push({
      date: currentDate,
      dayLabel: currentDayLabel,
      completedAt,
      completedTimeLabel,
      title,
      projectName,
      importKey,
    });
  }

  return tasks;
}

function getTodoistTargetLabel(entry: any, sectorsById: Map<string, WorkSector>, subTasksById: Map<string, SubTask>): string {
  const sector = sectorsById.get(entry.sectorId);
  const subTask = entry.subTaskId ? subTasksById.get(entry.subTaskId) : undefined;
  const start = getTimeLabel(entry.startAt);
  const end = getTimeLabel(entry.endAt);
  const title = entry.isPause ? "Pause" : sector?.name || "Sans tâche";

  return `${start}–${end} — ${title}${subTask ? ` / ${subTask.name}` : ""}`;
}

function findBestTodoistTargetId(
  task: Pick<TodoistImportTask, "completedAt" | "title" | "projectName">,
  options: Array<{ id: string; startAt: string; endAt: string; sectorName: string; subTaskName?: string; isPause?: boolean }>,
): string {
  if (options.length === 0) return "";

  const completed = new Date(task.completedAt).getTime();
  const inferredSectorNames = inferTodoistSectorNames(task).map((sectorName) => normalizeForKey(sectorName));

  return options
    .map((option, index) => {
      const start = new Date(option.startAt).getTime();
      const end = new Date(option.endAt).getTime();
      const distance = Number.isNaN(completed)
        ? index
        : Math.min(Math.abs(completed - start), Math.abs(completed - end));
      const containsCompletedAt = !Number.isNaN(completed) && completed >= start && completed <= end;
      const normalizedSectorName = normalizeForKey(option.sectorName);
      const sectorMatch = inferredSectorNames.includes(normalizedSectorName);
      const subTaskMatch = option.subTaskName
        ? normalizeForKey(task.title).includes(normalizeForKey(option.subTaskName))
        : false;

      let score = 0;
      if (!option.isPause) score += 1000;
      if (containsCompletedAt) score += 5000;
      if (sectorMatch) score += 10000;
      if (subTaskMatch) score += 2000;

      return { id: option.id, score, distance };
    })
    .sort((a, b) => b.score - a.score || a.distance - b.distance)[0]?.id ?? options[0].id;
}

export function SettingsPage() {
  const [sectors, setSectors] = useState<WorkSector[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetMode, setResetMode] = useState<"tracking" | "full" | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [exportRange, setExportRange] = useState<ExportRange>("all");
  const [customExportStartDate, setCustomExportStartDate] = useState(getCurrentMonthRange().startDate);
  const [customExportEndDate, setCustomExportEndDate] = useState(getCurrentMonthRange().endDate);
  const [exportIncludePauses, setExportIncludePauses] = useState(true);
  const [exportIncludeNotes, setExportIncludeNotes] = useState(true);
  const [jsonExportLoading, setJsonExportLoading] = useState(false);
  const [jsonImportLoading, setJsonImportLoading] = useState(false);
  const [jsonImportPreview, setJsonImportPreview] = useState<JsonImportPreview | null>(null);
  const [jsonImportMessage, setJsonImportMessage] = useState("");
  const [jsonImportError, setJsonImportError] = useState("");
  const [aiPromptCopied, setAiPromptCopied] = useState(false);
  const [dataJournal, setDataJournal] = useState<DataJournalEntry[]>(() =>
    loadDataJournalEntries(),
  );
  const [todoistImportLoading, setTodoistImportLoading] = useState(false);
  const [todoistImportPreview, setTodoistImportPreview] = useState<TodoistImportPreview | null>(null);
  const [todoistImportMessage, setTodoistImportMessage] = useState("");
  const [todoistImportError, setTodoistImportError] = useState("");
  const [todoistAddActionCounter, setTodoistAddActionCounter] = useState(false);
  const [todoistGroupSimilarTasks, setTodoistGroupSimilarTasks] = useState(true);
  const [statisticsSettings, setStatisticsSettings] = useState<StatisticsCalculationSettings>(() =>
    loadStatisticsCalculationSettings(),
  );

  const [draftSector, setDraftSector] = useState<DraftSector>({
    name: "",
    color: "#3b82f6",
  });

  const [draftTag, setDraftTag] = useState<DraftTag>({
    name: "",
  });

  const [draftSubTask, setDraftSubTask] = useState<DraftSubTask>({
    sectorId: "",
    name: "",
  });

  async function loadData() {
    const [allSectors, allSubTasks, allTags] = await Promise.all([
      sectorRepository.listAll(),
      subTaskRepository.listAll(),
      tagRepository.listAll(),
    ]);

    setSectors(allSectors);
    setSubTasks(allSubTasks);
    setTags(allTags);

    if (!draftSubTask.sectorId && allSectors.length > 0) {
      const firstUsableSector = allSectors.find((sector) => sector.id !== "pause");
      if (firstUsableSector) {
        setDraftSubTask((prev) => ({ ...prev, sectorId: firstUsableSector.id }));
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    saveStatisticsCalculationSettings(statisticsSettings);
  }, [statisticsSettings]);

  function handleToggleStatisticsDayOff(dayValue: number) {
    setStatisticsSettings((currentSettings) => {
      const isAlreadySelected = currentSettings.daysOff.includes(dayValue);

      return {
        ...currentSettings,
        daysOff: isAlreadySelected
          ? currentSettings.daysOff.filter((day) => day !== dayValue)
          : [...currentSettings.daysOff, dayValue].sort((a, b) => a - b),
      };
    });
  }

  function handleToggleStatisticsExcludedTag(tagId: string) {
    setStatisticsSettings((currentSettings) => {
      const isAlreadySelected = currentSettings.excludedTagIds.includes(tagId);

      return {
        ...currentSettings,
        excludedTagIds: isAlreadySelected
          ? currentSettings.excludedTagIds.filter((existingTagId) => existingTagId !== tagId)
          : [...currentSettings.excludedTagIds, tagId],
      };
    });
  }

  function handleUpdateNonWorkingDayThreshold(value: string) {
    const nextThreshold = Math.max(0, Math.round(Number(value) || 0));

    setStatisticsSettings((currentSettings) => ({
      ...currentSettings,
      nonWorkingDayThresholdMinutes: nextThreshold,
    }));
  }

  function handleUpdateWeekStartsOn(weekStartsOn: WeekStartsOn) {
    setStatisticsSettings((currentSettings) => ({
      ...currentSettings,
      weekStartsOn,
    }));
  }

  function handleResetStatisticsSettings() {
    setStatisticsSettings(DEFAULT_STATISTICS_SETTINGS);
  }

  function addDataJournalEntry(entry: Omit<DataJournalEntry, "id" | "createdAt">) {
    setDataJournal((currentEntries) => {
      const nextEntries: DataJournalEntry[] = [
        {
          ...entry,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        },
        ...currentEntries,
      ].slice(0, MAX_DATA_JOURNAL_ENTRIES);

      saveDataJournalEntries(nextEntries);
      return nextEntries;
    });
  }

  function handleClearDataJournal() {
    saveDataJournalEntries([]);
    setDataJournal([]);
  }

  async function handleCreateSector() {
    const trimmedName = draftSector.name.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const nextDisplayOrder =
        sectors.length > 0 ? Math.max(...sectors.map((sector) => sector.displayOrder)) + 1 : 1;

      const newSector: WorkSector = {
        id: crypto.randomUUID(),
        name: trimmedName,
        color: draftSector.color,
        icon: undefined,
        displayOrder: nextDisplayOrder,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      await sectorRepository.create(newSector);

      setDraftSector({
        name: "",
        color: "#3b82f6",
      });

      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSector(
    sector: WorkSector,
    updates: Partial<Pick<WorkSector, "name" | "color">>,
  ) {
    const updatedSector: WorkSector = {
      ...sector,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await sectorRepository.update(updatedSector);
    await loadData();
  }

  async function handleToggleActiveSector(sector: WorkSector) {
    await sectorRepository.setActive(sector.id, !sector.isActive);
    await loadData();
  }

  async function handleToggleArchivedSector(sector: WorkSector) {
    if (sector.isArchived) {
      await sectorRepository.unarchive(sector.id);
    } else {
      await sectorRepository.archive(sector.id);
    }
    await loadData();
  }

  async function handleCreateTag() {
    const trimmedName = draftTag.name.trim();
    if (!trimmedName) return;

    const exists = tags.some((tag) => tag.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();

      const newTag: Tag = {
        id: crypto.randomUUID(),
        name: trimmedName,
        color: undefined,
        description: undefined,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      await tagRepository.create(newTag);
      setDraftTag({ name: "" });
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSubTask() {
    const trimmedName = draftSubTask.name.trim();
    if (!trimmedName || !draftSubTask.sectorId) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();

      const sameSectorSubTasks = subTasks.filter(
        (subTask) => subTask.sectorId === draftSubTask.sectorId,
      );

      const nextDisplayOrder =
        sameSectorSubTasks.length > 0
          ? Math.max(...sameSectorSubTasks.map((subTask) => subTask.displayOrder)) + 1
          : 1;

      const newSubTask: SubTask = {
        id: crypto.randomUUID(),
        sectorId: draftSubTask.sectorId,
        name: trimmedName,
        defaultActionType: undefined,
        displayOrder: nextDisplayOrder,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      await subTaskRepository.create(newSubTask);

      setDraftSubTask((prev) => ({
        ...prev,
        name: "",
      }));

      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSubTask(
    subTask: SubTask,
    updates: Partial<Pick<SubTask, "name" | "sectorId">>,
  ) {
    const updatedSubTask: SubTask = {
      ...subTask,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await subTaskRepository.update(updatedSubTask);
    await loadData();
  }

  async function handleToggleActiveSubTask(subTask: SubTask) {
    await subTaskRepository.setActive(subTask.id, !subTask.isActive);
    await loadData();
  }

  async function handleToggleArchivedSubTask(subTask: SubTask) {
    if (subTask.isArchived) {
      await subTaskRepository.unarchive(subTask.id);
    } else {
      await subTaskRepository.archive(subTask.id);
    }
    await loadData();
  }

  async function handleUpdateTag(tag: Tag, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const updatedTag: Tag = {
      ...tag,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    };

    await tagRepository.update(updatedTag);
    await loadData();
  }

  async function handleToggleActiveTag(tag: Tag) {
    await tagRepository.setActive(tag.id, !tag.isActive);
    await loadData();
  }

  async function handleToggleArchivedTag(tag: Tag) {
    if (tag.isArchived) {
      await tagRepository.unarchive(tag.id);
    } else {
      await tagRepository.archive(tag.id);
    }
    await loadData();
  }

  function getSelectedExportRange(): ExportDateRange | null {
    if (exportRange === "all") return null;
    if (exportRange === "currentWeek") return getCurrentWeekRange();
    if (exportRange === "currentMonth") return getCurrentMonthRange();

    if (!customExportStartDate || !customExportEndDate) return null;

    const startDate = customExportStartDate <= customExportEndDate ? customExportStartDate : customExportEndDate;
    const endDate = customExportStartDate <= customExportEndDate ? customExportEndDate : customExportStartDate;

    return {
      startDate,
      endDate,
      label: `Du ${formatDateLabel(startDate)} au ${formatDateLabel(endDate)}`,
    };
  }

  async function buildExportData(): Promise<ExportData> {
    const range = getSelectedExportRange();

    const [rawEntries, allSectors, allSubTasks, allTags, allLinks, allActions] =
      await Promise.all([
        db.timeEntries.toArray(),
        db.workSectors.toArray(),
        db.subTasks.toArray(),
        db.tags.toArray(),
        db.timeEntryTags.toArray(),
        db.entryActions.toArray(),
      ]);

    const sectorsById = new Map(allSectors.map((sector) => [sector.id, sector]));
    const subTasksById = new Map(allSubTasks.map((subTask) => [subTask.id, subTask]));
    const tagsById = new Map(allTags.map((tag) => [tag.id, tag]));

    const rows = rawEntries
      .slice()
      .filter((entry) => isDateInRange(entry.date || entry.startAt.slice(0, 10), range))
      .filter((entry) => exportIncludePauses || !entry.isPause)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((entry): ExportDataRow => {
        const sector = sectorsById.get(entry.sectorId);
        const subTask = entry.subTaskId ? subTasksById.get(entry.subTaskId) : undefined;

        const tagNames = allLinks
          .filter((link) => link.timeEntryId === entry.id)
          .map((link) => tagsById.get(link.tagId)?.name)
          .filter(Boolean) as string[];

        const actionsLabel = allActions
          .filter((action) => action.timeEntryId === entry.id)
          .map((action) => {
            const actionType = action.actionType?.trim() || "Action";
            return `${actionType}: ${action.quantity}`;
          })
          .join(" | ");

        const durationSeconds =
          entry.durationSeconds ??
          Math.max(
            0,
            Math.round(
              (new Date(entry.endAt).getTime() - new Date(entry.startAt).getTime()) / 1000,
            ),
          );

        const date = entry.date || entry.startAt.slice(0, 10);
        const type = entry.isPause ? "Pause" : "Travail";
        const sectorName = sector?.name || "";
        const subTaskName = subTask?.name || "";
        const importKey = buildImportKey({
          date,
          startAt: entry.startAt,
          endAt: entry.endAt,
          type,
          sectorName,
          subTaskName,
        });

        return {
          importKey,
          id: entry.id,
          date,
          startAt: entry.startAt,
          endAt: entry.endAt,
          startTime: getTimeLabel(entry.startAt),
          endTime: getTimeLabel(entry.endAt),
          durationSeconds,
          durationLabel: formatCsvDurationFromSeconds(durationSeconds),
          type,
          isPause: entry.isPause,
          sectorName,
          subTaskName,
          tagNames,
          tagsLabel: tagNames.join(" | "),
          notes: exportIncludeNotes ? entry.notes || "" : "",
          actionsLabel,
        };
      });

    return {
      rows,
      rangeLabel: range?.label || "Toutes les données",
      totalSeconds: rows.reduce((sum, row) => sum + row.durationSeconds, 0),
      workSeconds: rows.filter((row) => !row.isPause).reduce((sum, row) => sum + row.durationSeconds, 0),
      pauseSeconds: rows.filter((row) => row.isPause).reduce((sum, row) => sum + row.durationSeconds, 0),
    };
  }

  async function handleExportCsv() {
    setExportLoading(true);

    try {
      const exportData = await buildExportData();

      const headers = [
        "import_key",
        "id",
        "date",
        "debut_iso",
        "fin_iso",
        "heure_debut",
        "heure_fin",
        "duree_secondes",
        "duree",
        "type",
        "tache",
        "sous_tache",
        "tags",
        "note",
        "actions",
      ];

      const rows = exportData.rows.map((row) => [
        row.importKey,
        row.id,
        row.date,
        row.startAt,
        row.endAt,
        row.startTime,
        row.endTime,
        row.durationSeconds,
        row.durationLabel,
        row.type,
        row.sectorName,
        row.subTaskName,
        row.tagsLabel,
        row.notes,
        row.actionsLabel,
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
        .join("\n");

      downloadCsv(
        `export-suivi-temps-${new Date().toISOString().slice(0, 10)}.csv`,
        csvContent,
      );

      addDataJournalEntry({
        type: "export_csv",
        title: "Export CSV",
        description: `${exportData.rows.length} entrée${exportData.rows.length > 1 ? "s" : ""} exportée${exportData.rows.length > 1 ? "s" : ""}`,
        detail: exportData.rangeLabel,
      });
    } finally {
      setExportLoading(false);
    }
  }

  function buildMarkdownForAi(exportData: ExportData): string {
    const rowsByDate = new Map<string, ExportDataRow[]>();
    const totalsByTask = new Map<string, number>();

    for (const row of exportData.rows) {
      const existingRows = rowsByDate.get(row.date) ?? [];
      existingRows.push(row);
      rowsByDate.set(row.date, existingRows);

      const taskLabel = row.isPause ? "Pause" : row.sectorName || "Sans tâche";
      totalsByTask.set(taskLabel, (totalsByTask.get(taskLabel) ?? 0) + row.durationSeconds);
    }

    const taskSummary = Array.from(totalsByTask.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, seconds]) => {
        const percent = exportData.totalSeconds > 0 ? Math.round((seconds / exportData.totalSeconds) * 100) : 0;
        return `- ${label} : ${formatCsvDurationFromSeconds(seconds)} (${percent}%)`;
      });

    const detailByDay = Array.from(rowsByDate.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .flatMap(([date, rows]) => [
        `### ${formatDateLabel(date)}`,
        "",
        ...rows.map((row) => {
          const parts = [
            `${row.startTime}–${row.endTime}`,
            row.isPause ? "Pause" : row.sectorName || "Sans tâche",
            row.subTaskName,
            row.tagsLabel ? `tags : ${row.tagsLabel}` : "",
            row.actionsLabel ? `actions : ${row.actionsLabel}` : "",
            row.notes ? `note : ${row.notes}` : "",
          ].filter(Boolean);

          return `- ${parts.join(" — ")}`;
        }),
        "",
      ]);

    return [
      `# Export IA — Suivi du temps`,
      "",
      `Période : ${exportData.rangeLabel}`,
      `Export généré le : ${new Date().toLocaleString("fr-CA")}`,
      "",
      "## Résumé global",
      "",
      `- Temps total : ${formatCsvDurationFromSeconds(exportData.totalSeconds)}`,
      `- Temps de travail : ${formatCsvDurationFromSeconds(exportData.workSeconds)}`,
      `- Temps de pause : ${formatCsvDurationFromSeconds(exportData.pauseSeconds)}`,
      `- Nombre d’entrées : ${exportData.rows.length}`,
      "",
      "## Répartition par tâche",
      "",
      ...(taskSummary.length > 0 ? taskSummary : ["Aucune donnée sur cette période."]),
      "",
      "## Détail par jour",
      "",
      ...(detailByDay.length > 0 ? detailByDay : ["Aucune entrée à afficher."]),
      "## Questions utiles à poser à une IA",
      "",
      "- Quelles tâches prennent le plus de place dans mon mois ?",
      "- Est-ce que mon temps est plutôt concentré ou fragmenté ?",
      "- Quels jours semblent les plus chargés ?",
      "- Quelles pistes d’amélioration vois-tu dans mon organisation ?",
      "",
    ].join("\n");
  }

  async function handleExportMarkdownForAi() {
    setExportLoading(true);

    try {
      const exportData = await buildExportData();
      const markdown = buildMarkdownForAi(exportData);

      downloadTextFile(
        `export-ia-suivi-temps-${new Date().toISOString().slice(0, 10)}.md`,
        markdown,
        "text/markdown;charset=utf-8;",
      );

      addDataJournalEntry({
        type: "export_markdown",
        title: "Export Markdown IA",
        description: `${exportData.rows.length} entrée${exportData.rows.length > 1 ? "s" : ""} préparée${exportData.rows.length > 1 ? "s" : ""} pour l’analyse`,
        detail: exportData.rangeLabel,
      });
    } finally {
      setExportLoading(false);
    }
  }

  async function handleCopyAiAnalysisPrompt() {
    setExportLoading(true);
    setAiPromptCopied(false);

    try {
      const exportData = await buildExportData();
      const markdown = buildMarkdownForAi(exportData);
      const prompt = [
        "Tu es un assistant spécialisé en organisation du travail et en analyse du temps.",
        "Analyse les données ci-dessous avec un regard pratique, concret et bienveillant.",
        "",
        "Je veux que tu me donnes :",
        "1. Une synthèse courte de mon utilisation du temps.",
        "2. Les tâches qui prennent le plus de place.",
        "3. Les périodes ou journées les plus chargées.",
        "4. Les signes éventuels de fragmentation ou de dispersion.",
        "5. Une lecture du ratio travail / pauses.",
        "6. Trois recommandations concrètes pour mieux organiser mon temps.",
        "7. Trois questions à me poser pour affiner l’analyse.",
        "",
        "Voici mes données :",
        "",
        markdown,
      ].join("\n");

      await copyTextToClipboard(prompt);
      setAiPromptCopied(true);
      window.setTimeout(() => setAiPromptCopied(false), 2500);

      addDataJournalEntry({
        type: "export_prompt",
        title: "Prompt IA copié",
        description: `${exportData.rows.length} entrée${exportData.rows.length > 1 ? "s" : ""} intégrée${exportData.rows.length > 1 ? "s" : ""} au prompt`,
        detail: exportData.rangeLabel,
      });
    } finally {
      setExportLoading(false);
    }
  }

  async function handleExportJsonBackup() {
    setJsonExportLoading(true);

    try {
      const [workSectors, subTasks, allTags, timeEntries, timeEntryTags, entryActions, activeSessions] =
        await Promise.all([
          db.workSectors.toArray(),
          db.subTasks.toArray(),
          db.tags.toArray(),
          db.timeEntries.toArray(),
          db.timeEntryTags.toArray(),
          db.entryActions.toArray(),
          db.activeSessions.toArray(),
        ]);

      const backup = {
        format: "outil-suivi-temps-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        tables: {
          workSectors,
          subTasks,
          tags: allTags,
          timeEntries,
          timeEntryTags,
          entryActions,
          activeSessions,
        },
      };

      downloadTextFile(
        `sauvegarde-suivi-temps-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2),
        "application/json;charset=utf-8;",
      );

      addDataJournalEntry({
        type: "export_json",
        title: "Sauvegarde JSON",
        description: `${timeEntries.length} entrée${timeEntries.length > 1 ? "s" : ""}, ${workSectors.length} tâche${workSectors.length > 1 ? "s" : ""}, ${allTags.length} tag${allTags.length > 1 ? "s" : ""}`,
        detail: "Sauvegarde complète de la base locale",
      });
    } finally {
      setJsonExportLoading(false);
    }
  }

  function handleDownloadCsvImportErrorReport() {
    if (!importPreview) return;

    const headers = ["ligne", "date", "debut", "fin", "tache", "erreurs"];
    const rows = importPreview.rows
      .map((row, index) => ({ row, lineNumber: index + 2 }))
      .filter(({ row }) => row.errors.length > 0)
      .map(({ row, lineNumber }) => [
        lineNumber,
        row.date,
        row.startAt,
        row.endAt,
        row.sectorName,
        row.errors.join(" | "),
      ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");

    downloadCsv(
      `rapport-erreurs-import-csv-${new Date().toISOString().slice(0, 10)}.csv`,
      csvContent,
    );
  }

  async function buildJsonImportPreview(fileName: string, backup: unknown): Promise<JsonImportPreview> {
    const tables = readBackupTables(backup);
    const errors: string[] = [];

    if (!backup || typeof backup !== "object") {
      errors.push("Le fichier JSON n’a pas une structure valide.");
    }

    const maybeBackup = backup as { format?: unknown; version?: unknown };
    if (maybeBackup.format !== "outil-suivi-temps-backup") {
      errors.push("Ce fichier ne semble pas être une sauvegarde exportée par l’application.");
    }

    const workSectors = safeArrayFromBackup(tables.workSectors);
    const backupSubTasks = safeArrayFromBackup(tables.subTasks);
    const backupTags = safeArrayFromBackup(tables.tags);
    const timeEntries = safeArrayFromBackup(tables.timeEntries);
    const timeEntryTags = safeArrayFromBackup(tables.timeEntryTags);
    const entryActions = safeArrayFromBackup(tables.entryActions);
    const activeSessions = safeArrayFromBackup(tables.activeSessions);

    const [existingSectors, existingSubTasks, existingTags, existingEntries, existingLinks, existingActions, existingSessions] =
      await Promise.all([
        db.workSectors.toArray(),
        db.subTasks.toArray(),
        db.tags.toArray(),
        db.timeEntries.toArray(),
        db.timeEntryTags.toArray(),
        db.entryActions.toArray(),
        db.activeSessions.toArray(),
      ]);

    const countNewItems = (items: any[], existingItems: Array<{ id: string }>) => {
      const existingIds = new Set(existingItems.map((item) => item.id));
      return items.filter((item) => item?.id && !existingIds.has(item.id)).length;
    };

    return {
      fileName,
      backup,
      errors,
      workSectorsCount: workSectors.length,
      subTasksCount: backupSubTasks.length,
      tagsCount: backupTags.length,
      timeEntriesCount: timeEntries.length,
      timeEntryTagsCount: timeEntryTags.length,
      entryActionsCount: entryActions.length,
      activeSessionsCount: activeSessions.length,
      newWorkSectorsCount: countNewItems(workSectors, existingSectors),
      newSubTasksCount: countNewItems(backupSubTasks, existingSubTasks),
      newTagsCount: countNewItems(backupTags, existingTags),
      newTimeEntriesCount: countNewItems(timeEntries, existingEntries),
      newTimeEntryTagsCount: countNewItems(timeEntryTags, existingLinks),
      newEntryActionsCount: countNewItems(entryActions, existingActions),
      newActiveSessionsCount: countNewItems(activeSessions, existingSessions),
    };
  }

  async function handleJsonImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setJsonImportLoading(true);
    setJsonImportMessage("");
    setJsonImportError("");
    setJsonImportPreview(null);

    try {
      const jsonText = await file.text();
      const parsedBackup = JSON.parse(jsonText) as unknown;
      const preview = await buildJsonImportPreview(file.name, parsedBackup);
      setJsonImportPreview(preview);
    } catch (error) {
      console.error(error);
      setJsonImportError("Impossible de lire ce fichier JSON.");
    } finally {
      setJsonImportLoading(false);
    }
  }

  async function handleConfirmImportJson() {
    if (!jsonImportPreview || jsonImportPreview.errors.length > 0) return;

    setJsonImportLoading(true);
    setJsonImportMessage("");
    setJsonImportError("");

    try {
      const tables = readBackupTables(jsonImportPreview.backup);
      const workSectors = safeArrayFromBackup(tables.workSectors);
      const backupSubTasks = safeArrayFromBackup(tables.subTasks);
      const backupTags = safeArrayFromBackup(tables.tags);
      const timeEntries = safeArrayFromBackup(tables.timeEntries);
      const timeEntryTags = safeArrayFromBackup(tables.timeEntryTags);
      const entryActions = safeArrayFromBackup(tables.entryActions);
      const activeSessions = safeArrayFromBackup(tables.activeSessions);

      await db.transaction(
        "rw",
        [db.workSectors, db.subTasks, db.tags, db.timeEntries, db.timeEntryTags, db.entryActions, db.activeSessions],
        async () => {
          const existingSectors = new Set((await db.workSectors.toArray()).map((item) => item.id));
          const existingSubTasks = new Set((await db.subTasks.toArray()).map((item) => item.id));
          const existingTags = new Set((await db.tags.toArray()).map((item) => item.id));
          const existingEntries = new Set((await db.timeEntries.toArray()).map((item) => item.id));
          const existingLinks = new Set((await db.timeEntryTags.toArray()).map((item) => item.id));
          const existingActions = new Set((await db.entryActions.toArray()).map((item) => item.id));
          const existingSessions = new Set((await db.activeSessions.toArray()).map((item) => item.id));

          await db.workSectors.bulkPut(workSectors.filter((item) => item?.id && !existingSectors.has(item.id)) as WorkSector[]);
          await db.subTasks.bulkPut(backupSubTasks.filter((item) => item?.id && !existingSubTasks.has(item.id)) as SubTask[]);
          await db.tags.bulkPut(backupTags.filter((item) => item?.id && !existingTags.has(item.id)) as Tag[]);
          await db.timeEntries.bulkPut(timeEntries.filter((item) => item?.id && !existingEntries.has(item.id)) as any[]);
          await db.timeEntryTags.bulkPut(timeEntryTags.filter((item) => item?.id && !existingLinks.has(item.id)) as any[]);
          await db.entryActions.bulkPut(entryActions.filter((item) => item?.id && !existingActions.has(item.id)) as any[]);
          await db.activeSessions.bulkPut(activeSessions.filter((item) => item?.id && !existingSessions.has(item.id)) as any[]);
        },
      );

      const totalImported =
        jsonImportPreview.newWorkSectorsCount +
        jsonImportPreview.newSubTasksCount +
        jsonImportPreview.newTagsCount +
        jsonImportPreview.newTimeEntriesCount +
        jsonImportPreview.newTimeEntryTagsCount +
        jsonImportPreview.newEntryActionsCount +
        jsonImportPreview.newActiveSessionsCount;

      setJsonImportMessage(`${totalImported} élément${totalImported > 1 ? "s" : ""} ajouté${totalImported > 1 ? "s" : ""} depuis la sauvegarde JSON.`);
      addDataJournalEntry({
        type: "import_json",
        title: "Import JSON",
        description: `${totalImported} élément${totalImported > 1 ? "s" : ""} ajouté${totalImported > 1 ? "s" : ""}`,
        detail: jsonImportPreview.fileName,
      });
      setJsonImportPreview(null);
      await loadData();
    } catch (error) {
      console.error(error);
      setJsonImportError("L’import JSON a échoué. Aucune donnée n’a été supprimée.");
    } finally {
      setJsonImportLoading(false);
    }
  }

  async function buildImportPreviewFromCsv(fileName: string, csvText: string): Promise<ImportPreview> {
    const [rawEntries, allSectors, allSubTasks, allTags] = await Promise.all([
      db.timeEntries.toArray(),
      db.workSectors.toArray(),
      db.subTasks.toArray(),
      db.tags.toArray(),
    ]);

    const sectorsById = new Map(allSectors.map((sector) => [sector.id, sector]));
    const subTasksById = new Map(allSubTasks.map((subTask) => [subTask.id, subTask]));
    const existingSectorNames = new Set(allSectors.map((sector) => normalizeForKey(sector.name)));
    const existingTagNames = new Set(allTags.map((tag) => normalizeForKey(tag.name)));
    const existingSubTaskKeys = new Set(
      allSubTasks.map((subTask) => {
        const sector = sectorsById.get(subTask.sectorId);
        return `${normalizeForKey(sector?.name)}|${normalizeForKey(subTask.name)}`;
      }),
    );

    const existingImportKeys = new Set(
      rawEntries.map((entry) => {
        const sector = sectorsById.get(entry.sectorId);
        const subTask = entry.subTaskId ? subTasksById.get(entry.subTaskId) : undefined;
        return buildImportKey({
          date: entry.date || entry.startAt.slice(0, 10),
          startAt: entry.startAt,
          endAt: entry.endAt,
          type: entry.isPause ? "Pause" : "Travail",
          sectorName: sector?.name || "",
          subTaskName: subTask?.name || "",
        });
      }),
    );

    const parsedRows = csvRowsToObjects(csvText);
    const seenImportKeys = new Set<string>();
    const rows: ImportCsvRow[] = parsedRows.map((row) => {
      const startAt = parseIsoFromCsv(row, "debut_iso", "heure_debut");
      const endAt = parseIsoFromCsv(row, "fin_iso", "heure_fin");
      const date = row.date?.trim() || startAt.slice(0, 10);
      const type = row.type?.trim() || "Travail";
      const isPause = normalizeForKey(type) === "pause";
      const sectorName = isPause ? "Pause" : row.tache?.trim() || row.secteur?.trim() || "";
      const subTaskName = row.sous_tache?.trim() || "";
      const notes = row.note?.trim() || row.notes?.trim() || "";
      const tagNames = parseTagsFromCsv(row.tags ?? "");
      const actions = parseActionsFromCsv(row.actions ?? "");
      const durationSecondsFromCsv = Number(row.duree_secondes);
      const durationSeconds = Number.isFinite(durationSecondsFromCsv)
        ? Math.max(0, Math.round(durationSecondsFromCsv))
        : Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 1000));

      const computedImportKey = buildImportKey({
        date,
        startAt,
        endAt,
        type: isPause ? "Pause" : "Travail",
        sectorName,
        subTaskName,
      });

      const importKey = row.import_key?.trim() || computedImportKey;
      const errors: string[] = [];

      if (!date) errors.push("Date manquante.");
      if (!startAt || Number.isNaN(new Date(startAt).getTime())) errors.push("Début invalide.");
      if (!endAt || Number.isNaN(new Date(endAt).getTime())) errors.push("Fin invalide.");
      if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
        errors.push("La fin doit être après le début.");
      }
      if (!isPause && !sectorName) errors.push("Tâche manquante.");
      if (seenImportKeys.has(importKey)) errors.push("Doublon dans le fichier importé.");

      const isDuplicate = existingImportKeys.has(importKey);
      seenImportKeys.add(importKey);

      return {
        importKey,
        originalId: row.id?.trim() || "",
        date,
        startAt,
        endAt,
        durationSeconds,
        type: isPause ? "Pause" : "Travail",
        isPause,
        sectorName,
        subTaskName,
        tagNames,
        notes,
        actions,
        isDuplicate,
        errors,
      };
    });

    const importableRows = rows.filter((row) => row.errors.length === 0 && !row.isDuplicate);
    const sectorsToCreate = Array.from(
      new Set(
        importableRows
          .filter((row) => !row.isPause && !existingSectorNames.has(normalizeForKey(row.sectorName)))
          .map((row) => row.sectorName),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr"));

    const sectorNamesAfterImport = new Set([
      ...existingSectorNames,
      ...sectorsToCreate.map(normalizeForKey),
    ]);

    const subTasksToCreate = importableRows
      .filter((row) => !row.isPause && row.subTaskName)
      .filter((row) => {
        const key = `${normalizeForKey(row.sectorName)}|${normalizeForKey(row.subTaskName)}`;
        return sectorNamesAfterImport.has(normalizeForKey(row.sectorName)) && !existingSubTaskKeys.has(key);
      })
      .reduce<Array<{ sectorName: string; subTaskName: string }>>((list, row) => {
        const key = `${normalizeForKey(row.sectorName)}|${normalizeForKey(row.subTaskName)}`;
        const alreadyListed = list.some(
          (item) => `${normalizeForKey(item.sectorName)}|${normalizeForKey(item.subTaskName)}` === key,
        );
        if (!alreadyListed) {
          list.push({ sectorName: row.sectorName, subTaskName: row.subTaskName });
        }
        return list;
      }, [])
      .sort((a, b) => `${a.sectorName} ${a.subTaskName}`.localeCompare(`${b.sectorName} ${b.subTaskName}`, "fr"));

    const tagsToCreate = Array.from(
      new Set(
        importableRows
          .flatMap((row) => row.tagNames)
          .filter((tagName) => !existingTagNames.has(normalizeForKey(tagName))),
      ),
    ).sort((a, b) => a.localeCompare(b, "fr"));

    return {
      fileName,
      rows,
      totalRows: rows.length,
      validRows: rows.filter((row) => row.errors.length === 0).length,
      duplicateRows: rows.filter((row) => row.isDuplicate).length,
      invalidRows: rows.filter((row) => row.errors.length > 0).length,
      importableRows: importableRows.length,
      sectorsToCreate,
      subTasksToCreate,
      tagsToCreate,
    };
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setImportLoading(true);
    setImportMessage("");
    setImportError("");
    setImportPreview(null);

    try {
      const csvText = await file.text();
      const preview = await buildImportPreviewFromCsv(file.name, csvText);
      setImportPreview(preview);
    } catch (error) {
      console.error(error);
      setImportError("Impossible de lire ce fichier CSV.");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleConfirmImportCsv() {
    if (!importPreview) return;

    const rowsToImport = importPreview.rows.filter(
      (row) => row.errors.length === 0 && !row.isDuplicate,
    );

    if (rowsToImport.length === 0) {
      setImportError("Aucune nouvelle ligne valide à importer.");
      return;
    }

    setImportLoading(true);
    setImportMessage("");
    setImportError("");

    try {
      const now = new Date().toISOString();

      await db.transaction(
        "rw",
        [db.workSectors, db.subTasks, db.tags, db.timeEntries, db.timeEntryTags, db.entryActions],
        async () => {
          const allSectors = await db.workSectors.toArray();
          const allSubTasks = await db.subTasks.toArray();
          const allTags = await db.tags.toArray();

          const sectorsByName = new Map(allSectors.map((sector) => [normalizeForKey(sector.name), sector]));
          const tagsByName = new Map(allTags.map((tag) => [normalizeForKey(tag.name), tag]));
          const subTasksBySectorAndName = new Map<string, SubTask>();

          if (!sectorsByName.has(normalizeForKey("Pause"))) {
            const pauseSector: WorkSector = {
              id: "pause",
              name: "Pause",
              color: "#f59e0b",
              icon: undefined,
              displayOrder: 999,
              isActive: true,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            };

            await db.workSectors.put(pauseSector);
            sectorsByName.set(normalizeForKey("Pause"), pauseSector);
          }

          for (const subTask of allSubTasks) {
            const sector = allSectors.find((item) => item.id === subTask.sectorId);
            const key = `${normalizeForKey(sector?.name)}|${normalizeForKey(subTask.name)}`;
            subTasksBySectorAndName.set(key, subTask);
          }

          let nextSectorDisplayOrder =
            allSectors.length > 0 ? Math.max(...allSectors.map((sector) => sector.displayOrder)) + 1 : 1;

          for (const sectorName of importPreview.sectorsToCreate) {
            const key = normalizeForKey(sectorName);
            if (sectorsByName.has(key)) continue;

            const newSector: WorkSector = {
              id: crypto.randomUUID(),
              name: sectorName,
              color: "#737373",
              icon: undefined,
              displayOrder: nextSectorDisplayOrder,
              isActive: true,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            };

            nextSectorDisplayOrder += 1;
            await db.workSectors.put(newSector);
            sectorsByName.set(key, newSector);
          }

          for (const tagName of importPreview.tagsToCreate) {
            const key = normalizeForKey(tagName);
            if (tagsByName.has(key)) continue;

            const newTag: Tag = {
              id: crypto.randomUUID(),
              name: tagName,
              color: undefined,
              description: undefined,
              isActive: true,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            };

            await db.tags.put(newTag);
            tagsByName.set(key, newTag);
          }

          for (const item of importPreview.subTasksToCreate) {
            const sector = sectorsByName.get(normalizeForKey(item.sectorName));
            if (!sector) continue;

            const key = `${normalizeForKey(item.sectorName)}|${normalizeForKey(item.subTaskName)}`;
            if (subTasksBySectorAndName.has(key)) continue;

            const existingForSector = Array.from(subTasksBySectorAndName.values()).filter(
              (subTask) => subTask.sectorId === sector.id,
            );
            const nextDisplayOrder =
              existingForSector.length > 0
                ? Math.max(...existingForSector.map((subTask) => subTask.displayOrder)) + 1
                : 1;

            const newSubTask: SubTask = {
              id: crypto.randomUUID(),
              sectorId: sector.id,
              name: item.subTaskName,
              defaultActionType: undefined,
              displayOrder: nextDisplayOrder,
              isActive: true,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            };

            await db.subTasks.put(newSubTask);
            subTasksBySectorAndName.set(key, newSubTask);
          }

          for (const row of rowsToImport) {
            const sector = row.isPause
              ? sectorsByName.get(normalizeForKey("Pause"))
              : sectorsByName.get(normalizeForKey(row.sectorName));
            if (!sector) continue;

            const subTaskKey = `${normalizeForKey(row.sectorName)}|${normalizeForKey(row.subTaskName)}`;
            const subTask = row.subTaskName ? subTasksBySectorAndName.get(subTaskKey) : undefined;
            const timeEntryId = crypto.randomUUID();

            await db.timeEntries.put({
              id: timeEntryId,
              date: row.date,
              startAt: row.startAt,
              endAt: row.endAt,
              durationSeconds: row.durationSeconds,
              sectorId: row.isPause ? "pause" : sector.id,
              subTaskId: row.isPause ? undefined : subTask?.id,
              energy: row.isPause ? undefined : "bon",
              notes: row.notes || undefined,
              source: "manual",
              isPause: row.isPause,
              createdAt: now,
              updatedAt: now,
            });

            for (const tagName of row.tagNames) {
              const tag = tagsByName.get(normalizeForKey(tagName));
              if (!tag) continue;

              await db.timeEntryTags.put({
                id: crypto.randomUUID(),
                timeEntryId,
                tagId: tag.id,
              });
            }

            for (const action of row.actions) {
              await db.entryActions.put({
                id: crypto.randomUUID(),
                timeEntryId,
                actionType: action.actionType,
                quantity: action.quantity,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        },
      );

      setImportMessage(`${rowsToImport.length} nouvelle${rowsToImport.length > 1 ? "s" : ""} entrée${rowsToImport.length > 1 ? "s" : ""} importée${rowsToImport.length > 1 ? "s" : ""}.`);
      addDataJournalEntry({
        type: "import_csv",
        title: "Import CSV",
        description: `${rowsToImport.length} entrée${rowsToImport.length > 1 ? "s" : ""} ajoutée${rowsToImport.length > 1 ? "s" : ""}`,
        detail: `${importPreview.fileName} — ${importPreview.duplicateRows} doublon${importPreview.duplicateRows > 1 ? "s" : ""} ignoré${importPreview.duplicateRows > 1 ? "s" : ""}`,
      });
      setImportPreview(null);
      await loadData();
    } catch (error) {
      console.error(error);
      setImportError("L’import a échoué. Aucune donnée n’a été supprimée.");
    } finally {
      setImportLoading(false);
    }
  }

  async function buildTodoistImportPreview(fileName: string, markdown: string): Promise<TodoistImportPreview> {
    const rawTasks = parseTodoistReportMarkdown(fileName, markdown);

    const [allEntries, allSectors, allSubTasks] = await Promise.all([
      db.timeEntries.toArray(),
      db.workSectors.toArray(),
      db.subTasks.toArray(),
    ]);

    const sectorsById = new Map(allSectors.map((sector) => [sector.id, sector]));
    const subTasksById = new Map(allSubTasks.map((subTask) => [subTask.id, subTask]));
    const entriesByDate = new Map<string, typeof allEntries>();

    for (const entry of allEntries) {
      const existing = entriesByDate.get(entry.date) ?? [];
      existing.push(entry);
      entriesByDate.set(entry.date, existing);
    }

    const tasks: TodoistImportTask[] = rawTasks.map((task) => {
      const sameDayEntries = (entriesByDate.get(task.date) ?? [])
        .slice()
        .sort((a, b) => a.startAt.localeCompare(b.startAt));

      const targetOptions = sameDayEntries.map((entry) => ({
        id: entry.id,
        label: getTodoistTargetLabel(entry, sectorsById, subTasksById),
      }));

      const selectedTargetId = findBestTodoistTargetId(
        task,
        sameDayEntries.map((entry) => {
          const sector = sectorsById.get(entry.sectorId);
          const subTask = entry.subTaskId ? subTasksById.get(entry.subTaskId) : undefined;

          return {
            id: entry.id,
            startAt: entry.startAt,
            endAt: entry.endAt,
            sectorName: entry.isPause ? "Pause" : sector?.name || "",
            subTaskName: subTask?.name,
            isPause: entry.isPause,
          };
        }),
      );

      const isDuplicate = sameDayEntries.some((entry) => notesContainTodoistTask(entry.notes, task));
      const errors: string[] = [];

      if (targetOptions.length === 0) {
        errors.push("Aucune entrée de temps trouvée pour cette date.");
      }

      return {
        ...task,
        selected: !isDuplicate && errors.length === 0,
        targetTimeEntryId: selectedTargetId,
        targetOptions,
        importProjectAsTag: shouldImportTodoistProjectAsTag(task.projectName),
        suggestedTagName: task.projectName,
        isDuplicate,
        duplicateMode: "ignore",
        errors,
      };
    });

    return {
      fileName,
      tasks,
      totalTasks: tasks.length,
    };
  }

  function updateTodoistImportTask(importKey: string, updates: Partial<Pick<TodoistImportTask, "selected" | "targetTimeEntryId" | "importProjectAsTag" | "duplicateMode">>) {
    setTodoistImportPreview((currentPreview) => {
      if (!currentPreview) return currentPreview;

      return {
        ...currentPreview,
        tasks: currentPreview.tasks.map((task) =>
          task.importKey === importKey ? { ...task, ...updates } : task,
        ),
      };
    });
  }

  function canImportTodoistTask(task: TodoistImportTask): boolean {
    if (task.errors.length > 0) return false;
    if (!task.targetTimeEntryId) return false;
    if (task.isDuplicate && task.duplicateMode === "ignore") return false;
    return true;
  }

  function setAllTodoistImportTasksSelected(selected: boolean) {
    setTodoistImportPreview((currentPreview) => {
      if (!currentPreview) return currentPreview;

      return {
        ...currentPreview,
        tasks: currentPreview.tasks.map((task) => ({
          ...task,
          selected: selected ? canImportTodoistTask(task) : false,
        })),
      };
    });
  }

  async function handleTodoistImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setTodoistImportLoading(true);
    setTodoistImportMessage("");
    setTodoistImportError("");
    setTodoistImportPreview(null);

    try {
      const markdown = await file.text();
      const preview = await buildTodoistImportPreview(file.name, markdown);
      setTodoistImportPreview(preview);
    } catch (error) {
      console.error(error);
      setTodoistImportError("Impossible de lire ce rapport Todoist.");
    } finally {
      setTodoistImportLoading(false);
    }
  }

  async function handleConfirmTodoistImport() {
    if (!todoistImportPreview) return;

    const tasksToImport = todoistImportPreview.tasks.filter(
      (task) => task.selected && canImportTodoistTask(task),
    );

    if (tasksToImport.length === 0) {
      setTodoistImportError("Aucune tâche Todoist valide sélectionnée pour l’import.");
      return;
    }

    setTodoistImportLoading(true);
    setTodoistImportMessage("");
    setTodoistImportError("");

    try {
      const now = new Date().toISOString();
      const tasksByTargetEntry = new Map<string, TodoistImportTask[]>();

      for (const task of tasksToImport) {
        const existingTasks = tasksByTargetEntry.get(task.targetTimeEntryId) ?? [];
        existingTasks.push(task);
        tasksByTargetEntry.set(task.targetTimeEntryId, existingTasks);
      }

      let createdTagCount = 0;
      let createdLinkCount = 0;
      let createdActionCount = 0;

      await db.transaction("rw", [db.timeEntries, db.workSectors, db.tags, db.timeEntryTags, db.entryActions], async () => {
        const allTags = await db.tags.toArray();
        const allEntries = await db.timeEntries.toArray();
        const allSectors = await db.workSectors.toArray();
        const tagsByName = new Map(allTags.map((tag) => [normalizeForKey(tag.name), tag]));
        const sectorsById = new Map(allSectors.map((sector) => [sector.id, sector]));
        const existingLinks = new Set(
          (await db.timeEntryTags.toArray()).map((link) => `${link.timeEntryId}|${link.tagId}`),
        );

        for (const [timeEntryId, tasks] of tasksByTargetEntry.entries()) {
          const entry = await db.timeEntries.get(timeEntryId);
          if (!entry) continue;

          const noteBuild = buildTodoistNoteLines(tasks, todoistGroupSimilarTasks);

          const tasksToReplace = tasks.filter((task) => task.isDuplicate && task.duplicateMode === "replace");

          if (tasksToReplace.length > 0) {
            const replaceNoteBuild = buildTodoistNoteLines(tasksToReplace, todoistGroupSimilarTasks);
            const datesToClean = Array.from(new Set(tasksToReplace.map((task) => task.date)));
            for (const dateToClean of datesToClean) {
              const entriesForDate = allEntries.filter((existingEntry) => existingEntry.date === dateToClean);
              for (const entryForDate of entriesForDate) {
                const cleanedNotes = removeTodoistLinesFromNotes(entryForDate.notes, replaceNoteBuild.removedExistingLines);
                if (cleanedNotes === entryForDate.notes) continue;

                await db.timeEntries.put({
                  ...entryForDate,
                  notes: cleanedNotes,
                  updatedAt: now,
                });

                if (entryForDate.id === entry.id) {
                  entry.notes = cleanedNotes;
                }
              }
            }
          }

          const currentEntry = await db.timeEntries.get(timeEntryId);
          if (!currentEntry) continue;

          await db.timeEntries.put({
            ...currentEntry,
            notes: appendTodoistLinesToNotes(currentEntry.notes, noteBuild.lines, "add"),
            updatedAt: now,
          });

          if (todoistAddActionCounter && noteBuild.actionQuantity > 0) {
            const sector = sectorsById.get(currentEntry.sectorId);
            const actionType = currentEntry.isPause ? "Pause" : sector?.name?.trim() || "Action";

            await db.entryActions.put({
              id: crypto.randomUUID(),
              timeEntryId,
              actionType,
              quantity: noteBuild.actionQuantity,
              createdAt: now,
              updatedAt: now,
            });
            createdActionCount += 1;
          }

          for (const task of tasks) {
            if (!task.importProjectAsTag || !task.suggestedTagName.trim()) continue;

            const tagKey = normalizeForKey(task.suggestedTagName);
            let tag = tagsByName.get(tagKey);

            if (!tag) {
              tag = {
                id: crypto.randomUUID(),
                name: task.suggestedTagName.trim(),
                color: undefined,
                description: undefined,
                isActive: true,
                isArchived: false,
                createdAt: now,
                updatedAt: now,
              };

              await db.tags.put(tag);
              tagsByName.set(tagKey, tag);
              createdTagCount += 1;
            }

            const linkKey = `${timeEntryId}|${tag.id}`;
            if (existingLinks.has(linkKey)) continue;

            await db.timeEntryTags.put({
              id: crypto.randomUUID(),
              timeEntryId,
              tagId: tag.id,
            });
            existingLinks.add(linkKey);
            createdLinkCount += 1;
          }
        }
      });

      setTodoistImportMessage(
        `${tasksToImport.length} tâche${tasksToImport.length > 1 ? "s" : ""} Todoist importée${tasksToImport.length > 1 ? "s" : ""} dans les notes, une ligne par tâche. ${createdLinkCount} tag${createdLinkCount > 1 ? "s" : ""} lié${createdLinkCount > 1 ? "s" : ""}, dont ${createdTagCount} créé${createdTagCount > 1 ? "s" : ""}. ${createdActionCount} compteur${createdActionCount > 1 ? "s" : ""} d’action ajouté${createdActionCount > 1 ? "s" : ""}.`,
      );
      addDataJournalEntry({
        type: "import_todoist",
        title: "Import Todoist",
        description: `${tasksToImport.length} tâche${tasksToImport.length > 1 ? "s" : ""} ajoutée${tasksToImport.length > 1 ? "s" : ""}`,
        detail: todoistImportPreview.fileName,
      });
      setTodoistImportPreview(null);
    } catch (error) {
      console.error(error);
      setTodoistImportError("L’import Todoist a échoué. Aucune donnée existante n’a été supprimée.");
    } finally {
      setTodoistImportLoading(false);
    }
  }


  async function handleCleanupLegacyTodoistImport() {
    const confirmed = window.confirm(
      "Cette action va corriger les anciennes notes Todoist importées dans l’ancien format et supprimer les compteurs d’action Todoist. Les autres données ne seront pas supprimées. Continuer ?",
    );

    if (!confirmed) return;

    setTodoistImportLoading(true);
    setTodoistImportMessage("");
    setTodoistImportError("");

    try {
      const now = new Date().toISOString();
      let updatedEntriesCount = 0;
      let deletedActionsCount = 0;

      await db.transaction("rw", [db.timeEntries, db.entryActions], async () => {
        const allEntries = await db.timeEntries.toArray();

        for (const entry of allEntries) {
          const sanitized = sanitizeLegacyTodoistNotes(entry.notes);
          if (!sanitized.changed) continue;

          await db.timeEntries.put({
            ...entry,
            notes: sanitized.notes,
            updatedAt: now,
          });
          updatedEntriesCount += 1;
        }

        const todoistActions = (await db.entryActions.toArray()).filter(
          (action) => normalizeForKey(action.actionType) === "todoist",
        );

        for (const action of todoistActions) {
          await db.entryActions.delete(action.id);
          deletedActionsCount += 1;
        }
      });

      setTodoistImportMessage(
        `Ancien import Todoist corrigé : ${updatedEntriesCount} entrée${updatedEntriesCount > 1 ? "s" : ""} nettoyée${updatedEntriesCount > 1 ? "s" : ""}, ${deletedActionsCount} action${deletedActionsCount > 1 ? "s" : ""} Todoist supprimée${deletedActionsCount > 1 ? "s" : ""}.`,
      );
      addDataJournalEntry({
        type: "import_todoist",
        title: "Correction import Todoist",
        description: `${updatedEntriesCount} note${updatedEntriesCount > 1 ? "s" : ""} nettoyée${updatedEntriesCount > 1 ? "s" : ""}`,
        detail: `${deletedActionsCount} action${deletedActionsCount > 1 ? "s" : ""} Todoist supprimée${deletedActionsCount > 1 ? "s" : ""}`,
      });
      await loadData();
    } catch (error) {
      console.error(error);
      setTodoistImportError("Impossible de corriger l’ancien import Todoist.");
    } finally {
      setTodoistImportLoading(false);
    }
  }

  async function handleResetTrackingData() {
    setResetLoading(true);

    try {
      await db.transaction(
        "rw",
        [db.timeEntries, db.timeEntryTags, db.entryActions, db.activeSessions],
        async () => {
          await db.timeEntryTags.clear();
          await db.entryActions.clear();
          await db.timeEntries.clear();
          await db.activeSessions.clear();
        },
      );

      setResetMode(null);
      setResetConfirmText("");
      await loadData();
    } finally {
      setResetLoading(false);
    }
  }

  async function handleFullReset() {
    setResetLoading(true);

    try {
      await db.transaction(
        "rw",
        [
          db.workSectors,
          db.subTasks,
          db.tags,
          db.timeEntries,
          db.timeEntryTags,
          db.entryActions,
          db.activeSessions,
        ],
        async () => {
          await db.timeEntryTags.clear();
          await db.entryActions.clear();
          await db.timeEntries.clear();
          await db.activeSessions.clear();
          await db.subTasks.clear();
          await db.tags.clear();
          await db.workSectors.clear();

          const now = new Date().toISOString();

          await db.workSectors.put({
            id: "pause",
            name: "Pause",
            color: "#f59e0b",
            icon: undefined,
            displayOrder: 999,
            isActive: true,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });
        },
      );

      setResetMode(null);
      setResetConfirmText("");
      await loadData();
    } finally {
      setResetLoading(false);
    }
  }

  async function handleConfirmReset() {
    if (!resetMode) return;

    if (resetMode === "tracking") {
      await handleResetTrackingData();
      return;
    }

    if (resetMode === "full") {
      if (resetConfirmText.trim() !== "RESET") {
        return;
      }

      await handleFullReset();
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeaderNav
          currentPage="parametres"
          title="Paramètres"
          subtitle="Gestion des tâches, sous-tâches, tags, exports, imports et sauvegardes."
        />

        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Modifier les tâches, sous-tâches et tags</h2>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Modifie rapidement les éléments existants. Les cartes sont condensées pour éviter une longue ligne par élément.
              </p>
            </div>

            {!loading ? (
              <div className="flex flex-wrap gap-2 text-xs font-medium text-neutral-600">
                <span className="rounded-full bg-neutral-100 px-3 py-1">{sectors.length} tâche{sectors.length > 1 ? "s" : ""}</span>
                <span className="rounded-full bg-neutral-100 px-3 py-1">{subTasks.length} sous-tâche{subTasks.length > 1 ? "s" : ""}</span>
                <span className="rounded-full bg-neutral-100 px-3 py-1">{tags.length} tag{tags.length > 1 ? "s" : ""}</span>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-neutral-600">Chargement…</p>
          ) : (
            <div className="grid gap-5 xl:grid-cols-3">
              <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                <h3 className="text-base font-semibold text-neutral-900">Tâches</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {sectors.map((sector) => {
                    const isPauseSector = sector.id === "pause";

                    return (
                      <div key={sector.id} className="rounded-2xl bg-white p-3 ring-1 ring-neutral-200">
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={sector.color}
                            disabled={isPauseSector}
                            onChange={(e) =>
                              void handleUpdateSector(sector, { color: e.target.value })
                            }
                            className="h-10 w-12 shrink-0 rounded-xl border border-neutral-300 bg-white px-1 py-1 disabled:bg-neutral-100"
                            aria-label="Couleur de la tâche"
                          />

                          <input
                            type="text"
                            value={sector.name}
                            disabled={isPauseSector}
                            onChange={(e) =>
                              void handleUpdateSector(sector, { name: e.target.value })
                            }
                            className="min-w-0 flex-1 rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${sector.isActive
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"
                              }`}
                          >
                            {sector.isActive ? "Actif" : "Inactif"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${sector.isArchived
                                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                              }`}
                          >
                            {sector.isArchived ? "Archivé" : "Visible"}
                          </span>

                          {!isPauseSector ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleToggleActiveSector(sector)}
                                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                              >
                                {sector.isActive ? "Désactiver" : "Activer"}
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleToggleArchivedSector(sector)}
                                className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                              >
                                {sector.isArchived ? "Désarchiver" : "Archiver"}
                              </button>
                            </>
                          ) : (
                            <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
                              Système
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                <h3 className="text-base font-semibold text-neutral-900">Sous-tâches</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {subTasks.map((subTask) => {
                    const parentSector = sectors.find((sector) => sector.id === subTask.sectorId);

                    return (
                      <div key={subTask.id} className="rounded-2xl bg-white p-3 ring-1 ring-neutral-200">
                        <div className="grid gap-2">
                          <input
                            type="text"
                            value={subTask.name}
                            onChange={(e) => void handleUpdateSubTask(subTask, { name: e.target.value })}
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
                          />

                          <select
                            value={subTask.sectorId}
                            onChange={(e) =>
                              void handleUpdateSubTask(subTask, { sectorId: e.target.value })
                            }
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
                          >
                            {sectors
                              .filter((sector) => sector.id !== "pause")
                              .map((sector) => (
                                <option key={sector.id} value={sector.id}>
                                  {sector.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        {parentSector ? (
                          <p className="mt-2 text-xs text-neutral-500">Tâche : {parentSector.name}</p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${subTask.isActive
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"
                              }`}
                          >
                            {subTask.isActive ? "Actif" : "Inactif"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${subTask.isArchived
                                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                              }`}
                          >
                            {subTask.isArchived ? "Archivé" : "Visible"}
                          </span>

                          <button
                            type="button"
                            onClick={() => void handleToggleActiveSubTask(subTask)}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            {subTask.isActive ? "Désactiver" : "Activer"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleArchivedSubTask(subTask)}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            {subTask.isArchived ? "Désarchiver" : "Archiver"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                <h3 className="text-base font-semibold text-neutral-900">Tags</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {tags.map((tag) => (
                    <div key={tag.id} className="rounded-2xl bg-white p-3 ring-1 ring-neutral-200">
                      <input
                        type="text"
                        value={tag.name}
                        onChange={(e) => void handleUpdateTag(tag, e.target.value)}
                        className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${tag.isActive
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"
                            }`}
                        >
                          {tag.isActive ? "Actif" : "Inactif"}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${tag.isArchived
                              ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                              : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                            }`}
                        >
                          {tag.isArchived ? "Archivé" : "Visible"}
                        </span>

                        <button
                          type="button"
                          onClick={() => void handleToggleActiveTag(tag)}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          {tag.isActive ? "Désactiver" : "Activer"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleArchivedTag(tag)}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          {tag.isArchived ? "Désarchiver" : "Archiver"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Créer de nouveaux éléments</h2>
            <p className="mt-2 max-w-3xl text-sm text-neutral-600">
              Ajoute une nouvelle tâche, une sous-tâche ou un tag depuis une seule zone.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Nouvelle tâche</h3>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Nom</label>
                  <input
                    type="text"
                    value={draftSector.name}
                    onChange={(e) =>
                      setDraftSector((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Couleur</label>
                  <input
                    type="color"
                    value={draftSector.color}
                    onChange={(e) =>
                      setDraftSector((prev) => ({ ...prev, color: e.target.value }))
                    }
                    className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-2 py-2"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateSector}
                  disabled={saving || !draftSector.name.trim()}
                  className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  Ajouter la tâche
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Nouvelle sous-tâche</h3>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Tâche</label>
                  <select
                    value={draftSubTask.sectorId}
                    onChange={(e) =>
                      setDraftSubTask((prev) => ({ ...prev, sectorId: e.target.value }))
                    }
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                  >
                    {sectors
                      .filter((sector) => sector.id !== "pause")
                      .map((sector) => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Nom</label>
                  <input
                    type="text"
                    value={draftSubTask.name}
                    onChange={(e) =>
                      setDraftSubTask((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex. appels entrants, emails, classement"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateSubTask}
                  disabled={saving || !draftSubTask.name.trim() || !draftSubTask.sectorId}
                  className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  Ajouter la sous-tâche
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Nouveau tag</h3>
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Nom</label>
                  <input
                    type="text"
                    value={draftTag.name}
                    onChange={(e) => setDraftTag({ name: e.target.value })}
                    placeholder="Ex. urgent, client, suivi"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateTag}
                  disabled={saving || !draftTag.name.trim()}
                  className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  Ajouter le tag
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Calcul des statistiques</h2>
              <p className="mt-2 max-w-3xl text-sm text-neutral-600">
                Définis les règles qui serviront plus tard aux moyennes et aux statistiques :
                jours habituellement non travaillés, tags à exclure, et seuil minimum pour compter
                un jour de congé comme vraiment travaillé.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetStatisticsSettings}
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Réinitialiser
            </button>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Premier jour de la semaine</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Ce réglage servira aux vues hebdomadaires, aux regroupements par semaine et aux
                moyennes hebdomadaires.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {WEEK_START_OPTIONS.map((option) => {
                  const isSelected = statisticsSettings.weekStartsOn === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleUpdateWeekStartsOn(option.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${isSelected
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"
                        }`}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-neutral-600 ring-1 ring-neutral-200">
                Actuellement : {statisticsSettings.weekStartsOn === 1
                  ? "semaine du lundi au dimanche"
                  : "semaine du dimanche au samedi"}.
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Jours habituellement non travaillés</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Un jour coché sera exclu des moyennes si aucune vraie journée de travail n’est détectée.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const isSelected = statisticsSettings.daysOff.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleToggleStatisticsDayOff(day.value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${isSelected
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"
                        }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Tags exclus des moyennes</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Les entrées portant ces tags resteront visibles, mais pourront être exclues des moyennes
                et des statistiques comptabilisées.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {tags.length === 0 ? (
                  <p className="text-sm text-neutral-500">Aucun tag disponible pour le moment.</p>
                ) : (
                  tags.map((tag) => {
                    const isSelected = statisticsSettings.excludedTagIds.includes(tag.id);

                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleToggleStatisticsExcludedTag(tag.id)}
                        className={`rounded-full px-4 py-2 text-sm font-medium ring-1 ${isSelected
                          ? "bg-neutral-900 text-white ring-neutral-900"
                          : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50"
                          }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Seuil pour compter un jour non travaillé</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Si tu travailles exceptionnellement un jour de congé, il ne sera compté comme jour actif
                statistique que si le temps comptabilisable atteint ce seuil.
              </p>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Seuil en minutes
                </label>
                <input
                  type="number"
                  min="0"
                  value={statisticsSettings.nonWorkingDayThresholdMinutes}
                  onChange={(event) => handleUpdateNonWorkingDayThreshold(event.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                />
              </div>

              <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-neutral-600 ring-1 ring-neutral-200">
                Exemple : avec un seuil de {statisticsSettings.nonWorkingDayThresholdMinutes} minutes,
                une urgence de 10 minutes un jour de congé ne comptera pas comme vraie journée active.
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Données et sauvegardes</h2>
            <p className="mt-2 max-w-3xl text-sm text-neutral-600">
              Exporte tes données pour les analyser, crée une sauvegarde complète, ou importe des
              fichiers existants sans supprimer tes données locales.
            </p>
          </div>

          <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Export pour analyse</h3>
                <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                  Choisis la période et le niveau de détail, puis exporte en CSV pour un tableur
                  ou en Markdown pour une analyse par IA.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">Période à exporter</label>
                <select
                  value={exportRange}
                  onChange={(event) => setExportRange(event.target.value as ExportRange)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                >
                  <option value="all">Toutes les données</option>
                  <option value="currentWeek">Semaine en cours</option>
                  <option value="currentMonth">Mois en cours</option>
                  <option value="custom">Dates personnalisées</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Du</label>
                  <input
                    type="date"
                    value={customExportStartDate}
                    disabled={exportRange !== "custom"}
                    onChange={(event) => setCustomExportStartDate(event.target.value)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-700">Au</label>
                  <input
                    type="date"
                    value={customExportEndDate}
                    disabled={exportRange !== "custom"}
                    onChange={(event) => setCustomExportEndDate(event.target.value)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-neutral-200">
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={exportIncludePauses}
                    onChange={(event) => setExportIncludePauses(event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  Inclure les pauses
                </label>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={exportIncludeNotes}
                    onChange={(event) => setExportIncludeNotes(event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  Inclure les notes
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                <h4 className="text-base font-semibold text-neutral-900">CSV pour tableur</h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Une ligne par entrée, avec date, horaires, durée, tâche, sous-tâche, tags,
                  notes, actions et une clé technique pour éviter les doublons.
                </p>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exportLoading}
                  className="mt-4 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {exportLoading ? "Export en cours..." : "Exporter en CSV"}
                </button>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                <h4 className="text-base font-semibold text-neutral-900">Markdown pour IA</h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Génère un fichier lisible avec résumé global, répartition par tâche et détail
                  par jour, prêt à transmettre à une IA.
                </p>
                <button
                  type="button"
                  onClick={handleExportMarkdownForAi}
                  disabled={exportLoading}
                  className="mt-4 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {exportLoading ? "Export en cours..." : "Exporter pour IA"}
                </button>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                <h4 className="text-base font-semibold text-neutral-900">Prompt prêt à copier</h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Copie un texte complet avec les données et les consignes d’analyse, prêt à coller
                  directement dans ChatGPT.
                </p>
                <button
                  type="button"
                  onClick={handleCopyAiAnalysisPrompt}
                  disabled={exportLoading}
                  className="mt-4 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {exportLoading ? "Préparation..." : aiPromptCopied ? "Prompt copié" : "Copier le prompt IA"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Sauvegarde complète</h3>
                <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                  Le JSON sert à conserver une copie complète de l’application : tâches,
                  sous-tâches, tags, entrées, liens, actions et sessions en cours.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportJsonBackup}
                disabled={jsonExportLoading}
                className="shrink-0 rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {jsonExportLoading ? "Sauvegarde en cours..." : "Exporter en JSON"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
            <div>
              <h3 className="text-lg font-semibold text-neutral-900">Import / restauration</h3>
              <p className="mt-1 max-w-3xl text-sm text-neutral-600">
                Les imports sont sécurisés : une prévisualisation est affichée avant confirmation,
                les doublons sont ignorés et aucune donnée existante n’est supprimée.
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                <h4 className="text-base font-semibold text-neutral-900">Importer un CSV</h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Ajoute des entrées depuis un fichier CSV exporté par l’application. Les tâches,
                  sous-tâches et tags manquants peuvent être créés automatiquement.
                </p>

                <label className="mt-4 inline-flex cursor-pointer rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  {importLoading ? "Lecture en cours..." : "Choisir un fichier CSV"}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importLoading}
                    onChange={handleImportFileChange}
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                <h4 className="text-base font-semibold text-neutral-900">Importer une sauvegarde JSON</h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Restaure une sauvegarde complète en ajoutant seulement les éléments absents de
                  la base locale.
                </p>

                <label className="mt-4 inline-flex cursor-pointer rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  {jsonImportLoading ? "Lecture en cours..." : "Choisir un fichier JSON"}
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    disabled={jsonImportLoading}
                    onChange={handleJsonImportFileChange}
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                <h4 className="text-base font-semibold text-neutral-900">Importer un rapport Todoist</h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Lis un rapport Markdown Todoist, puis rattache les tâches terminées aux entrées
                  de temps existantes du même jour.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                    {todoistImportLoading ? "Lecture en cours..." : "Choisir un rapport .md"}
                    <input
                      type="file"
                      accept=".md,text/markdown,text/plain"
                      className="hidden"
                      disabled={todoistImportLoading}
                      onChange={handleTodoistImportFileChange}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleCleanupLegacyTodoistImport}
                    disabled={todoistImportLoading}
                    className="rounded-full border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                  >
                    Corriger l’ancien import Todoist
                  </button>
                </div>
              </div>
            </div>

          {importError ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              {importError}
            </div>
          ) : null}

          {importMessage ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">
              {importMessage}
            </div>
          ) : null}

          {jsonImportError ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              {jsonImportError}
            </div>
          ) : null}

          {jsonImportMessage ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">
              {jsonImportMessage}
            </div>
          ) : null}

          {todoistImportError ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
              {todoistImportError}
            </div>
          ) : null}

          {todoistImportMessage ? (
            <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700 ring-1 ring-emerald-200">
              {todoistImportMessage}
            </div>
          ) : null}

          {importPreview ? (
            <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-neutral-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Prévisualisation de l’import CSV</h3>
                  <p className="mt-1 text-sm text-neutral-600">Fichier : {importPreview.fileName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {importPreview.invalidRows > 0 ? (
                    <button
                      type="button"
                      onClick={handleDownloadCsvImportErrorReport}
                      className="rounded-full border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Télécharger le rapport d’erreurs
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setImportPreview(null);
                      setImportError("");
                      setImportMessage("");
                    }}
                    disabled={importLoading}
                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImportCsv}
                    disabled={importLoading || importPreview.importableRows === 0}
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {importLoading ? "Import en cours..." : "Confirmer l’import"}
                  </button>
                </div>
              </div>


              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Lignes lues</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">{importPreview.totalRows}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
                  <p className="text-sm text-emerald-700">Nouvelles entrées</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">{importPreview.importableRows}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
                  <p className="text-sm text-amber-700">Doublons ignorés</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">{importPreview.duplicateRows}</p>
                </div>
                <div className="rounded-2xl bg-red-50 p-4 text-center ring-1 ring-red-200">
                  <p className="text-sm text-red-700">Lignes invalides</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">{importPreview.invalidRows}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h4 className="text-sm font-semibold text-neutral-900">Tâches à créer</h4>
                  <p className="mt-2 text-sm text-neutral-600">
                    {importPreview.sectorsToCreate.length > 0
                      ? importPreview.sectorsToCreate.join(", ")
                      : "Aucune"}
                  </p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h4 className="text-sm font-semibold text-neutral-900">Sous-tâches à créer</h4>
                  <p className="mt-2 text-sm text-neutral-600">
                    {importPreview.subTasksToCreate.length > 0
                      ? importPreview.subTasksToCreate
                        .slice(0, 8)
                        .map((item) => `${item.sectorName} / ${item.subTaskName}`)
                        .join(", ")
                      : "Aucune"}
                    {importPreview.subTasksToCreate.length > 8 ? "..." : ""}
                  </p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <h4 className="text-sm font-semibold text-neutral-900">Tags à créer</h4>
                  <p className="mt-2 text-sm text-neutral-600">
                    {importPreview.tagsToCreate.length > 0
                      ? importPreview.tagsToCreate.join(", ")
                      : "Aucun"}
                  </p>
                </div>
              </div>

              {importPreview.invalidRows > 0 ? (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
                  <h4 className="text-sm font-semibold text-red-900">Lignes invalides détectées</h4>
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm text-red-700">
                    {importPreview.rows
                      .map((row, index) => ({ row, lineNumber: index + 2 }))
                      .filter(({ row }) => row.errors.length > 0)
                      .slice(0, 12)
                      .map(({ row, lineNumber }) => (
                        <p key={`${row.importKey}-${lineNumber}`}>
                          Ligne {lineNumber} — {row.date || "Date inconnue"} — {row.errors.join(" ")}
                        </p>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {todoistImportPreview ? (
            <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-neutral-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Prévisualisation de l’import Todoist</h3>
                  <p className="mt-1 text-sm text-neutral-600">Fichier : {todoistImportPreview.fileName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAllTodoistImportTasksSelected(true)}
                    disabled={todoistImportLoading}
                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllTodoistImportTasksSelected(false)}
                    disabled={todoistImportLoading}
                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Tout désélectionner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTodoistImportPreview(null);
                      setTodoistImportError("");
                      setTodoistImportMessage("");
                    }}
                    disabled={todoistImportLoading}
                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmTodoistImport}
                    disabled={
                      todoistImportLoading ||
                      todoistImportPreview.tasks.filter(
                        (task) => task.selected && canImportTodoistTask(task),
                      ).length === 0
                    }
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {todoistImportLoading ? "Import en cours..." : "Confirmer l’import Todoist"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <label className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700 ring-1 ring-neutral-200">
                  <input
                    type="checkbox"
                    checked={todoistAddActionCounter}
                    onChange={(event) => setTodoistAddActionCounter(event.target.checked)}
                    disabled={todoistImportLoading}
                    className="mt-1 h-4 w-4 rounded border-neutral-300"
                  />
                  <span>
                    <span className="block font-semibold text-neutral-800">Ajouter un compteur d’actions</span>
                    <span className="mt-1 block text-xs text-neutral-500">Le compteur utilise le nom de l’entrée cible, par exemple Messages, Appels ou Suivis.</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-700 ring-1 ring-neutral-200">
                  <input
                    type="checkbox"
                    checked={todoistGroupSimilarTasks}
                    onChange={(event) => setTodoistGroupSimilarTasks(event.target.checked)}
                    disabled={todoistImportLoading}
                    className="mt-1 h-4 w-4 rounded border-neutral-300"
                  />
                  <span>
                    <span className="block font-semibold text-neutral-800">Regrouper les tâches similaires</span>
                    <span className="mt-1 block text-xs text-neutral-500">Exemple : “Écrire à X pour sa fête” devient “Écrire à N personnes pour leur fête”.</span>
                  </span>
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Tâches lues</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">{todoistImportPreview.totalTasks}</p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-200">
                  <p className="text-sm text-emerald-700">Sélectionnées</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-900">
                    {todoistImportPreview.tasks.filter((task) => task.selected && canImportTodoistTask(task)).length}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-center ring-1 ring-amber-200">
                  <p className="text-sm text-amber-700">Déjà présentes</p>
                  <p className="mt-1 text-2xl font-bold text-amber-900">
                    {todoistImportPreview.tasks.filter((task) => task.isDuplicate).length}
                  </p>
                </div>
                <div className="rounded-2xl bg-red-50 p-4 text-center ring-1 ring-red-200">
                  <p className="text-sm text-red-700">Sans cible</p>
                  <p className="mt-1 text-2xl font-bold text-red-900">
                    {todoistImportPreview.tasks.filter((task) => task.errors.length > 0).length}
                  </p>
                </div>
              </div>

              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {todoistImportPreview.tasks.map((task) => (
                  <div
                    key={task.importKey}
                    className={`rounded-2xl p-4 ring-1 ${
                      task.errors.length > 0
                        ? "bg-red-50 ring-red-200"
                        : task.isDuplicate
                          ? "bg-amber-50 ring-amber-200"
                          : "bg-neutral-50 ring-neutral-200"
                    }`}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <label className="flex min-w-0 flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.selected}
                          disabled={task.errors.length > 0 || (task.isDuplicate && task.duplicateMode === "ignore")}
                          onChange={(event) => updateTodoistImportTask(task.importKey, { selected: event.target.checked })}
                          className="mt-1 h-4 w-4 rounded border-neutral-300"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-neutral-900">
                            {task.completedTimeLabel} — {task.title}
                          </span>
                          <span className="mt-1 block text-xs text-neutral-600">
                            {formatDateLabel(task.date)}{task.projectName ? ` · Projet : ${task.projectName}` : ""}
                          </span>
                          {task.isDuplicate ? (
                            <span className="mt-1 block text-xs font-medium text-amber-700">Déjà présent dans les notes d’une entrée de cette journée.</span>
                          ) : null}
                          {todoistGroupSimilarTasks && getBirthdayMessageName(task.title) ? (
                            <span className="mt-1 block text-xs font-medium text-emerald-700">Sera regroupée avec les autres tâches “Écrire à X pour sa fête” lors de l’import.</span>
                          ) : null}
                          {task.errors.length > 0 ? (
                            <span className="mt-1 block text-xs font-medium text-red-700">{task.errors.join(" ")}</span>
                          ) : null}
                        </span>
                      </label>

                      <div className="w-full lg:w-[360px]">
                        {task.isDuplicate ? (
                          <div className="mb-3 rounded-2xl bg-white/80 p-3 ring-1 ring-amber-200">
                            <label className="mb-1 block text-xs font-semibold text-amber-800">Action pour cette tâche déjà présente</label>
                            <select
                              value={task.duplicateMode}
                              disabled={todoistImportLoading || task.errors.length > 0}
                              onChange={(event) => {
                                const duplicateMode = event.target.value as TodoistDuplicateMode;
                                updateTodoistImportTask(task.importKey, {
                                  duplicateMode,
                                  selected: duplicateMode !== "ignore" && task.errors.length === 0 && task.targetOptions.length > 0,
                                });
                              }}
                              className="w-full rounded-2xl border border-amber-300 bg-white px-3 py-2 text-xs text-neutral-900 outline-none disabled:opacity-50"
                            >
                              <option value="ignore">Ignorer cette tâche</option>
                              <option value="add">Ajouter quand même</option>
                              <option value="replace">Remplacer l’ancienne ligne correspondante</option>
                            </select>
                          </div>
                        ) : null}

                        <label className="mb-1 block text-xs font-medium text-neutral-600">Entrée cible</label>
                        <select
                          value={task.targetTimeEntryId}
                          disabled={task.targetOptions.length === 0 || (task.isDuplicate && task.duplicateMode === "ignore")}
                          onChange={(event) => updateTodoistImportTask(task.importKey, { targetTimeEntryId: event.target.value })}
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 outline-none disabled:bg-neutral-100 disabled:text-neutral-400"
                        >
                          {task.targetOptions.length === 0 ? (
                            <option value="">Aucune entrée trouvée</option>
                          ) : null}
                          {task.targetOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        {task.suggestedTagName ? (
                          <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
                            <input
                              type="checkbox"
                              checked={task.importProjectAsTag}
                              disabled={task.errors.length > 0 || (task.isDuplicate && task.duplicateMode === "ignore")}
                              onChange={(event) => updateTodoistImportTask(task.importKey, { importProjectAsTag: event.target.checked })}
                              className="h-4 w-4 rounded border-neutral-300"
                            />
                            <span>Ajouter le projet Todoist comme tag : {task.suggestedTagName}</span>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {jsonImportPreview ? (
            <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-neutral-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Prévisualisation de l’import JSON</h3>
                  <p className="mt-1 text-sm text-neutral-600">Fichier : {jsonImportPreview.fileName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setJsonImportPreview(null);
                      setJsonImportError("");
                      setJsonImportMessage("");
                    }}
                    disabled={jsonImportLoading}
                    className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImportJson}
                    disabled={jsonImportLoading || jsonImportPreview.errors.length > 0}
                    className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {jsonImportLoading ? "Import en cours..." : "Confirmer l’import JSON"}
                  </button>
                </div>
              </div>

              {jsonImportPreview.errors.length > 0 ? (
                <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                  {jsonImportPreview.errors.join(" ")}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Entrées de temps</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">{jsonImportPreview.newTimeEntriesCount}</p>
                  <p className="mt-1 text-xs text-neutral-500">sur {jsonImportPreview.timeEntriesCount} dans le fichier</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Tâches</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">{jsonImportPreview.newWorkSectorsCount}</p>
                  <p className="mt-1 text-xs text-neutral-500">sur {jsonImportPreview.workSectorsCount}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Sous-tâches</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">{jsonImportPreview.newSubTasksCount}</p>
                  <p className="mt-1 text-xs text-neutral-500">sur {jsonImportPreview.subTasksCount}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-4 text-center ring-1 ring-neutral-200">
                  <p className="text-sm text-neutral-500">Tags</p>
                  <p className="mt-1 text-2xl font-bold text-neutral-900">{jsonImportPreview.newTagsCount}</p>
                  <p className="mt-1 text-xs text-neutral-500">sur {jsonImportPreview.tagsCount}</p>
                </div>
              </div>

              <p className="mt-4 text-sm text-neutral-600">
                Les doublons déjà présents dans la base locale seront ignorés. Aucune donnée existante ne sera supprimée.
              </p>
            </div>
          ) : null}
          </div>

          <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Journal des sauvegardes et imports</h3>
                <p className="mt-1 max-w-3xl text-sm text-neutral-600">
                  Dernières actions effectuées depuis cette page. Ce journal est conservé localement dans ton navigateur.
                </p>
              </div>

              {dataJournal.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearDataJournal}
                  className="shrink-0 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Vider le journal
                </button>
              ) : null}
            </div>

            {dataJournal.length > 0 ? (
              <div className="mt-5 space-y-3">
                {dataJournal.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-neutral-200 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{entry.title}</p>
                      <p className="mt-1 text-sm text-neutral-600">{entry.description}</p>
                      {entry.detail ? (
                        <p className="mt-1 text-xs text-neutral-500">{entry.detail}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xs font-medium text-neutral-500">
                      {formatJournalDate(entry.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-white p-4 text-sm text-neutral-600 ring-1 ring-neutral-200">
                Aucune action enregistrée pour le moment. Les prochains exports, sauvegardes et imports apparaîtront ici.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-red-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Zone sensible</h2>
              <p className="mt-2 text-sm text-neutral-600">
                Ces actions suppriment des données locales de manière irréversible.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">
                Supprimer les données de suivi
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Supprime les entrées, pauses, actions, tags liés aux entrées et sessions en cours,
                mais conserve les tâches, sous-tâches et tags.
              </p>

              <button
                type="button"
                onClick={() => {
                  setResetMode("tracking");
                  setResetConfirmText("");
                }}
                className="mt-4 rounded-full bg-amber-100 px-5 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200"
              >
                Supprimer les données de suivi
              </button>
            </div>

            <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">
                Réinitialisation complète
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Supprime toutes les données locales de l’application. Les tâches, sous-tâches et tags
                seront aussi supprimés. Le secteur Pause sera recréé automatiquement.
              </p>

              <button
                type="button"
                onClick={() => {
                  setResetMode("full");
                  setResetConfirmText("");
                }}
                className="mt-4 rounded-full bg-red-100 px-5 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200"
              >
                Réinitialisation complète
              </button>
            </div>
          </div>
        </section>
      </div>

      {resetMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
                  {resetMode === "tracking"
                    ? "Supprimer les données de suivi ?"
                    : "Réinitialisation complète ?"}
                </h3>

                <p className="mt-2 text-sm text-neutral-600">
                  {resetMode === "tracking"
                    ? "Cette action supprimera toutes les entrées, pauses, actions, tags liés aux entrées et sessions en cours, mais conservera les tâches, sous-tâches et tags."
                    : "Cette action supprimera toutes les données locales de l’application. Pour confirmer, tape RESET ci-dessous."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (resetLoading) return;
                  setResetMode(null);
                  setResetConfirmText("");
                }}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Fermer
              </button>
            </div>

            {resetMode === "full" ? (
              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Tape RESET pour confirmer
                </label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  if (resetLoading) return;
                  setResetMode(null);
                  setResetConfirmText("");
                }}
                className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={
                  resetLoading ||
                  (resetMode === "full" && resetConfirmText.trim() !== "RESET")
                }
                className={`rounded-full px-5 py-3 text-sm font-medium text-white disabled:opacity-50 ${resetMode === "tracking" ? "bg-amber-600" : "bg-red-600"
                  }`}
              >
                {resetLoading
                  ? "Suppression en cours..."
                  : resetMode === "tracking"
                    ? "Oui, supprimer les données de suivi"
                    : "Oui, tout réinitialiser"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
