import { type ChangeEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

  async function handleExportCsv() {
    setExportLoading(true);

    try {
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

      const rows = rawEntries
        .slice()
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((entry) => {
          const sector = sectorsById.get(entry.sectorId);
          const subTask = entry.subTaskId ? subTasksById.get(entry.subTaskId) : undefined;

          const entryTags = allLinks
            .filter((link) => link.timeEntryId === entry.id)
            .map((link) => tagsById.get(link.tagId)?.name)
            .filter(Boolean)
            .join(" | ");

          const entryActions = allActions
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

          return [
            importKey,
            entry.id,
            date,
            entry.startAt,
            entry.endAt,
            getTimeLabel(entry.startAt),
            getTimeLabel(entry.endAt),
            durationSeconds,
            formatCsvDurationFromSeconds(durationSeconds),
            type,
            sectorName,
            subTaskName,
            entryTags,
            entry.notes || "",
            entryActions,
          ];
        });

      const csvContent = [headers, ...rows]
        .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
        .join("\n");

      downloadCsv(
        `export-suivi-temps-${new Date().toISOString().slice(0, 10)}.csv`,
        csvContent,
      );
    } finally {
      setExportLoading(false);
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
      setImportPreview(null);
      await loadData();
    } catch (error) {
      console.error(error);
      setImportError("L’import a échoué. Aucune donnée n’a été supprimée.");
    } finally {
      setImportLoading(false);
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
        <div>
          <Link
            to="/"
            className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          >
            Retour à l’accueil
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            Paramètres
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Gestion simple des secteurs, des sous-tâches et des tags.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Export et import des données</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                Exporte toutes les entrées de suivi en CSV pour les conserver, les ouvrir dans un
                tableur ou les analyser avec une IA. L’import ajoute uniquement les nouvelles lignes
                valides et ignore les doublons détectés.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exportLoading}
              className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {exportLoading ? "Export en cours..." : "Exporter en CSV"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Sauvegarde CSV</h3>
              <p className="mt-2">
                Le fichier contient une ligne par entrée, avec date, horaires, durée, tâche,
                sous-tâche, tags, notes, actions et une clé technique pour éviter les doublons à
                l’import.
              </p>
            </div>

            <div className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <h3 className="text-base font-semibold text-neutral-900">Importer un CSV</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Sélectionne un CSV exporté par l’application. Une prévisualisation sera affichée
                avant toute écriture dans la base locale.
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

          {importPreview ? (
            <div className="mt-5 rounded-3xl bg-white p-4 ring-1 ring-neutral-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Prévisualisation de l’import</h3>
                  <p className="mt-1 text-sm text-neutral-600">Fichier : {importPreview.fileName}</p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                      .filter((row) => row.errors.length > 0)
                      .slice(0, 8)
                      .map((row, index) => (
                        <p key={`${row.importKey}-${index}`}>
                          {row.date || "Date inconnue"} — {row.errors.join(" ")}
                        </p>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold text-neutral-900">Créer une sous-tâche</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Secteur
              </label>
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
              Ajouter
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold text-neutral-900">Créer un secteur</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
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
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Couleur
              </label>
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
              Ajouter
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold text-neutral-900">Créer un tag</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
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
              Ajouter
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-neutral-900">Secteurs existants</h2>
            {!loading && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {sectors.length} secteur{sectors.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : (
            <div className="mt-5 space-y-4">
              {sectors.map((sector) => {
                const isPauseSector = sector.id === "pause";

                return (
                  <div
                    key={sector.id}
                    className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_180px_auto] lg:items-start">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={sector.name}
                          disabled={isPauseSector}
                          onChange={(e) =>
                            void handleUpdateSector(sector, { name: e.target.value })
                          }
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Couleur
                        </label>
                        <input
                          type="color"
                          value={sector.color}
                          disabled={isPauseSector}
                          onChange={(e) =>
                            void handleUpdateSector(sector, { color: e.target.value })
                          }
                          className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-2 py-2 disabled:bg-neutral-100"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        {!isPauseSector ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleToggleActiveSector(sector)}
                              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              {sector.isActive ? "Désactiver" : "Activer"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleToggleArchivedSector(sector)}
                              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              {sector.isArchived ? "Désarchiver" : "Archiver"}
                            </button>
                          </>
                        ) : (
                          <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
                            Secteur système
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-neutral-900">Sous-tâches existantes</h2>
            {!loading && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {subTasks.length} sous-tâche{subTasks.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : (
            <div className="mt-5 space-y-4">
              {subTasks.map((subTask) => {
                const parentSector = sectors.find((sector) => sector.id === subTask.sectorId);

                return (
                  <div
                    key={subTask.id}
                    className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-start">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Nom
                        </label>
                        <input
                          type="text"
                          value={subTask.name}
                          onChange={(e) => void handleUpdateSubTask(subTask, { name: e.target.value })}
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-700">
                          Secteur
                        </label>
                        <select
                          value={subTask.sectorId}
                          onChange={(e) =>
                            void handleUpdateSubTask(subTask, { sectorId: e.target.value })
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

                        {parentSector ? (
                          <p className="mt-2 text-xs text-neutral-500">
                            Secteur actuel : {parentSector.name}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <button
                          type="button"
                          onClick={() => void handleToggleActiveSubTask(subTask)}
                          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          {subTask.isActive ? "Désactiver" : "Activer"}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleArchivedSubTask(subTask)}
                          className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          {subTask.isArchived ? "Désarchiver" : "Archiver"}
                        </button>
                      </div>
                    </div>

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
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-neutral-900">Tags existants</h2>
            {!loading && (
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {tags.length} tag{tags.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : (
            <div className="mt-5 space-y-4">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200"
                >
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-neutral-700">
                        Nom
                      </label>
                      <input
                        type="text"
                        value={tag.name}
                        onChange={(e) => void handleUpdateTag(tag, e.target.value)}
                        className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
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
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => void handleToggleActiveTag(tag)}
                        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        {tag.isActive ? "Désactiver" : "Activer"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleToggleArchivedTag(tag)}
                        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        {tag.isArchived ? "Désarchiver" : "Archiver"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
