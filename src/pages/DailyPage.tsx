import { useEffect, useMemo, useState } from "react";
import PageHeaderNav from "../components/PageHeaderNav";
import { aggregationService } from "../domain/timeTracking/aggregationService";
import { entryService } from "../domain/timeTracking/entryService";
import { db } from "../db/database";
import { subTaskRepository } from "../repositories/subTaskRepository";
import { timeEntryRepository } from "../repositories/timeEntryRepository";
import type { EntryAction, SubTask, Tag, TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";
import {
  findOverlappingEntries,
  validateActionDrafts,
  validateSectorSubTaskConsistency,
  validateSelectedSector,
  validateSelectedTags,
  validateTimeRange,
  validateTypedSubTaskName,
} from "../utils/validation";



function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoForDate(date: string, time: string): string {
  return `${date}T${time}:00`;
}

function shiftDateString(date: string, offsetDays: number): string {
  const base = new Date(`${date}T12:00:00`);
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("fr-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function diffSeconds(startIso: string, endIso: string): number {
  return Math.max(
    0,
    Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000),
  );
}

function isoToTimeInput(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function isoToDateInput(iso: string): string {
  return iso.slice(0, 10);
}

function resolveEditedIso({
  originalIso,
  originalDate,
  targetDate,
  targetTime,
}: {
  originalIso: string;
  originalDate: string;
  targetDate: string;
  targetTime: string;
}): string {
  const originalTime = isoToTimeInput(originalIso);
  const originalIsoDate = isoToDateInput(originalIso);
  const isSameVisibleTime = targetTime === originalTime;
  const isSameVisibleDate = targetDate === originalDate || targetDate === originalIsoDate;

  if (isSameVisibleDate && isSameVisibleTime) {
    return originalIso;
  }

  return toIsoForDate(targetDate, targetTime);
}

function parseTagInput(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
  subTask?: SubTask;
  tags?: Tag[];
  actions?: EntryAction[];
}

interface ActionDraft {
  actionType: string;
  quantity: number;
}

type DisplayMode = "grouped" | "chronological" | "duration";
type SortOrder = "asc" | "desc";

interface GroupedEntries {
  sectorId: string;
  sectorName: string;
  sectorColor: string;
  totalSeconds: number;
  entries: EntryWithSector[];
}

export function DailyPage() {
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [availableSectors, setAvailableSectors] = useState<WorkSector[]>([]);
  const [availableSubTasks, setAvailableSubTasks] = useState<SubTask[]>([]);
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [topSectorName, setTopSectorName] = useState("—");
  const [topSectorSeconds, setTopSectorSeconds] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayDateString());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedSectorId, setSelectedSectorId] = useState("");
  const [selectedSubTaskId, setSelectedSubTaskId] = useState("");
  const [newSubTaskName, setNewSubTaskName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [actionDrafts, setActionDrafts] = useState<ActionDraft[]>([]);
  const [isPause, setIsPause] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedFilterSectorId, setSelectedFilterSectorId] = useState("all");
  const [selectedFilterTagName, setSelectedFilterTagName] = useState("all");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("chronological");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  async function loadData() {
    const date = selectedDate;
    const rawEntries = await timeEntryRepository.listByDate(date);
    const totals = await aggregationService.getDailyTotals(date);

    const allSectors = await db.workSectors.toArray();
    const allSubTasks = await db.subTasks.toArray();
    const allTags = await db.tags.toArray();

    const usableSectors = allSectors
      .filter((sector) => sector.isActive && !sector.isArchived && sector.id !== "pause")
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const usableTags = allTags
      .filter((tag) => tag.isActive && !tag.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const usableSubTasks = allSubTasks
      .filter((subTask) => subTask.isActive && !subTask.isArchived)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const enrichedEntries = await Promise.all(
      rawEntries.map(async (entry) => {
        const sector = await db.workSectors.get(entry.sectorId);
        const subTask = entry.subTaskId ? await db.subTasks.get(entry.subTaskId) : undefined;
        const links = await db.timeEntryTags.where("timeEntryId").equals(entry.id).toArray();
        const tagResults = await Promise.all(links.map((link) => db.tags.get(link.tagId)));
        const tags = tagResults.filter(Boolean) as Tag[];
        const actions = await db.entryActions.where("timeEntryId").equals(entry.id).toArray();

        return {
          ...entry,
          sector,
          subTask,
          tags,
          actions,
        };
      }),
    );

    const sectorBuckets = new Map<string, number>();
    for (const entry of enrichedEntries) {
      if (entry.isPause) continue;
      const current = sectorBuckets.get(entry.sectorId) ?? 0;
      sectorBuckets.set(entry.sectorId, current + entry.durationSeconds);
    }

    if (sectorBuckets.size === 0) {
      setTopSectorName("—");
      setTopSectorSeconds(0);
    } else {
      const [topSectorId, seconds] = Array.from(sectorBuckets.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0];
      const matchingSector = allSectors.find((sector) => sector.id === topSectorId);
      setTopSectorName(matchingSector?.name ?? topSectorId);
      setTopSectorSeconds(seconds);
    }

    setEntries(enrichedEntries);
    setAvailableSectors(usableSectors);
    setAvailableSubTasks(usableSubTasks);
    setAllSubTasks(allSubTasks);
    setAvailableTags(usableTags);
    setAllTags(allTags);
    setActiveSeconds(totals.activeSeconds);
    setPauseSeconds(totals.pauseSeconds);

    if (!selectedSectorId && usableSectors.length > 0) {
      setSelectedSectorId(usableSectors[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (isPause) {
      setSelectedSubTaskId("");
      return;
    }

    if (!selectedSectorId) {
      setSelectedSubTaskId("");
      return;
    }

    const matchingSubTasks = availableSubTasks.filter(
      (subTask) => subTask.sectorId === selectedSectorId,
    );

    if (matchingSubTasks.length === 0) {
      setSelectedSubTaskId("");
      return;
    }

    const stillValid = matchingSubTasks.some((subTask) => subTask.id === selectedSubTaskId);
    if (!stillValid) {
      setSelectedSubTaskId("");
    }
  }, [isPause, selectedSectorId, selectedSubTaskId, availableSubTasks]);

  const filteredSubTasks = useMemo(() => {
    if (!selectedSectorId) return [];
    return availableSubTasks.filter((subTask) => subTask.sectorId === selectedSectorId);
  }, [availableSubTasks, selectedSectorId]);

  const isTodaySelected = selectedDate === todayDateString();
  const formattedSelectedDate = formatDateLabel(selectedDate);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const sectorOk =
        selectedFilterSectorId === "all" || entry.sectorId === selectedFilterSectorId;

      const tagOk =
        selectedFilterTagName === "all" ||
        Boolean(entry.tags?.some((tag) => tag.name === selectedFilterTagName));

      return sectorOk && tagOk;
    });
  }, [entries, selectedFilterSectorId, selectedFilterTagName]);

  const displayedEntries = useMemo(() => {
    const copied = [...filteredEntries];

    if (displayMode === "chronological") {
      copied.sort((a, b) => {
        const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
        return sortOrder === "asc" ? diff : -diff;
      });
      return copied;
    }

    if (displayMode === "duration") {
      copied.sort((a, b) => b.durationSeconds - a.durationSeconds);
      return copied;
    }

    copied.sort((a, b) => {
      const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });
    return copied;
  }, [filteredEntries, displayMode, sortOrder]);

  const groupedEntries = useMemo<GroupedEntries[]>(() => {
    const map = new Map<string, GroupedEntries>();

    for (const entry of filteredEntries) {
      const key = entry.sectorId;
      const existing = map.get(key);

      if (existing) {
        existing.totalSeconds += entry.durationSeconds;
        existing.entries.push(entry);
      } else {
        map.set(key, {
          sectorId: key,
          sectorName: entry.sector?.name ?? entry.sectorId,
          sectorColor: entry.sector?.color ?? (entry.isPause ? "#f59e0b" : "#737373"),
          totalSeconds: entry.durationSeconds,
          entries: [entry],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
  }, [filteredEntries]);

  function resetForm() {
    setEditingEntryId(null);
    setSelectedSubTaskId("");
    setNewSubTaskName("");
    setStartTime("09:00");
    setEndTime("10:00");
    setNote("");
    setSelectedTagNames([]);
    setNewTagInput("");
    setActionDrafts([]);
    setIsPause(false);
    setErrorMessage("");

    if (availableSectors.length > 0) {
      setSelectedSectorId(availableSectors[0].id);
    } else {
      setSelectedSectorId("");
    }
  }

  function openCreateModal() {
    resetForm();
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    resetForm();
  }

  function addActionDraft() {
    setActionDrafts((prev) => [...prev, { actionType: "", quantity: 1 }]);
  }

  function updateActionDraft(index: number, updates: Partial<ActionDraft>) {
    setActionDrafts((prev) =>
      prev.map((action, i) => (i === index ? { ...action, ...updates } : action)),
    );
  }

  function removeActionDraft(index: number) {
    setActionDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  function hasActions(actions?: EntryAction[]): boolean {
    return Boolean(actions && actions.length > 0);
  }

  function formatActionLabel(action: EntryAction): string {
    return `${action.actionType} · ${action.quantity}`;
  }

  function handleEditEntry(entry: EntryWithSector) {
    setEditingEntryId(entry.id);
    setIsPause(entry.isPause);
    setSelectedSectorId(entry.isPause ? "" : entry.sectorId);
    setSelectedSubTaskId(entry.isPause ? "" : entry.subTaskId ?? "");
    setNewSubTaskName("");
    setStartTime(isoToTimeInput(entry.startAt));
    setEndTime(isoToTimeInput(entry.endAt));
    setNote(entry.notes ?? "");
    setSelectedTagNames(entry.tags?.map((tag) => tag.name) ?? []);
    setNewTagInput("");
    setActionDrafts(
      entry.actions?.map((action) => ({
        actionType: action.actionType,
        quantity: action.quantity,
      })) ?? [],
    );
    setErrorMessage("");
    setIsModalOpen(true);
  }

  async function handleDeleteEntry(id: string) {
    const confirmed = window.confirm("Supprimer cette entrée ?");
    if (!confirmed) return;

    setSaving(true);
    try {
      await entryService.deleteEntry(id);
      if (editingEntryId === id) {
        closeModal();
      }
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEntry() {
    setErrorMessage("");

    const effectiveSectorId = isPause ? "pause" : selectedSectorId;
    const tagNames = [...selectedTagNames, ...parseTagInput(newTagInput)];
    const typedTagNames = parseTagInput(newTagInput);

    const tagsValidation = validateSelectedTags({
      selectedTagNames,
      typedTagNames,
      availableTags,
      allTags,
    });

    if (!tagsValidation.isValid) {
      setErrorMessage(tagsValidation.error ?? "Tags invalides.");
      return;
    }

    const typedSubTaskValidation = validateTypedSubTaskName({
      sectorId: effectiveSectorId,
      typedSubTaskName: newSubTaskName,
      allSubTasks,
      isPause,
    });

    if (!typedSubTaskValidation.isValid) {
      setErrorMessage(typedSubTaskValidation.error ?? "Sous-tâche invalide.");
      return;
    }

    const actionsValidation = validateActionDrafts(actionDrafts);

    if (!actionsValidation.isValid) {
      setErrorMessage(actionsValidation.error ?? "Actions invalides.");
      return;
    }

    const actionsPayload = actionDrafts
      .map((action) => ({
        actionType: action.actionType.trim(),
        quantity: Number(action.quantity),
      }))
      .filter((action) => action.actionType && Number.isFinite(action.quantity) && action.quantity > 0);

    if (!effectiveSectorId) {
      setErrorMessage("Choisis un secteur.");
      return;
    }

    const sectorValidation = validateSelectedSector({
      sectorId: effectiveSectorId,
      availableSectors,
      isPause,
    });

    if (!sectorValidation.isValid) {
      setErrorMessage(sectorValidation.error ?? "Secteur invalide.");
      return;
    }

    let resolvedSubTaskId: string | undefined = isPause ? undefined : selectedSubTaskId || undefined;

    if (!isPause && newSubTaskName.trim() && selectedSectorId) {
      const createdSubTask = await subTaskRepository.getOrCreateByName(
        selectedSectorId,
        newSubTaskName,
      );
      resolvedSubTaskId = createdSubTask.id;
    }

    if (resolvedSubTaskId) {
      const subTaskConsistency = validateSectorSubTaskConsistency({
        sectorId: effectiveSectorId,
        subTaskId: resolvedSubTaskId,
        availableSubTasks,
        isPause,
      });

      if (!subTaskConsistency.isValid) {
        setErrorMessage(subTaskConsistency.error ?? "Sous-tâche invalide.");
        return;
      }
    }

    const existingEntry = editingEntryId
      ? entries.find((entry) => entry.id === editingEntryId)
      : undefined;

    if (editingEntryId && !existingEntry) {
      setErrorMessage("Entrée introuvable.");
      return;
    }

    const startAt = existingEntry
      ? resolveEditedIso({
          originalIso: existingEntry.startAt,
          originalDate: existingEntry.date,
          targetDate: selectedDate,
          targetTime: startTime,
        })
      : toIsoForDate(selectedDate, startTime);

    const endAt = existingEntry
      ? resolveEditedIso({
          originalIso: existingEntry.endAt,
          originalDate: existingEntry.date,
          targetDate: selectedDate,
          targetTime: endTime,
        })
      : toIsoForDate(selectedDate, endTime);

    const durationSeconds = diffSeconds(startAt, endAt);

    const timeRangeValidation = validateTimeRange(startAt, endAt);

    if (!timeRangeValidation.isValid) {
      setErrorMessage(timeRangeValidation.error ?? "Plage horaire invalide.");
      return;
    }

    const overlapValidation = findOverlappingEntries(entries, {
      startAt,
      endAt,
      date: selectedDate,
      excludeEntryId: editingEntryId ?? undefined,
    });

    if (overlapValidation.hasOverlap) {
      setErrorMessage(
        overlapValidation.error ?? "Cette plage horaire chevauche une autre entrée existante.",
      );
      return;
    }

    setSaving(true);
    try {
      const nowIso = new Date().toISOString();

      if (editingEntryId) {
        if (!existingEntry) {
          setErrorMessage("Entrée introuvable.");
          return;
        }

        const updatedEntry: TimeEntry = {
          ...existingEntry,
          date: selectedDate,
          startAt,
          endAt,
          durationSeconds,
          sectorId: effectiveSectorId,
          subTaskId: resolvedSubTaskId,
          energy: isPause ? undefined : existingEntry.energy ?? "bon",
          notes: note.trim() || undefined,
          isPause,
          updatedAt: nowIso,
        };

        await entryService.updateEntry(updatedEntry, tagNames, actionsPayload);
      } else {
        const newEntry: TimeEntry = {
          id: crypto.randomUUID(),
          date: selectedDate,
          startAt,
          endAt,
          durationSeconds,
          sectorId: effectiveSectorId,
          subTaskId: resolvedSubTaskId,
          energy: isPause ? undefined : "bon",
          notes: note.trim() || undefined,
          source: "manual",
          isPause,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await entryService.createManualEntry(newEntry, tagNames, actionsPayload);
      }

      closeModal();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  function renderEntryCard(entry: EntryWithSector) {
    const isPauseEntry = entry.isPause;

    const metaItems: string[] = [];

    metaItems.push(
      `${new Date(entry.startAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })} – ${new Date(entry.endAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`,
    );

    if (entry.subTask) {
      metaItems.push(`Sous-tâche : ${entry.subTask.name}`);
    }

    return (
      <div
        key={entry.id}
        className={`rounded-2xl px-4 py-3 ring-1 ${isPauseEntry ? "bg-amber-50 ring-amber-200" : "bg-neutral-50 ring-neutral-200"
          }`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    entry.sector?.color ?? (isPauseEntry ? "#f59e0b" : "#737373"),
                }}
              />
              <p className="truncate text-base font-semibold text-neutral-900">
                {entry.sector?.name ?? entry.sectorId}
              </p>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${isPauseEntry
                    ? "bg-amber-100 text-amber-800"
                    : "bg-neutral-200 text-neutral-700"
                  }`}
              >
                {isPauseEntry ? "Pause" : "Travail"}
              </span>

              <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-neutral-900 ring-1 ring-neutral-200">
                {formatDurationFromSeconds(entry.durationSeconds)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleEditEntry(entry)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Modifier
              </button>

              <button
                type="button"
                onClick={() => void handleDeleteEntry(entry.id)}
                className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-200"
              >
                Supprimer
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600">
            {metaItems.map((item, index) => (
              <span
                key={`${entry.id}-meta-${index}`}
                className="rounded-full bg-white px-2.5 py-1 ring-1 ring-neutral-200"
              >
                {item}
              </span>
            ))}

            {entry.tags?.map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700"
              >
                {tag.name}
              </span>
            ))}

            {entry.actions?.map((action) => (
              <span
                key={action.id}
                className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800"
              >
                {formatActionLabel(action)}
              </span>
            ))}
          </div>

          {entry.notes ? (
            <p className="whitespace-pre-line rounded-2xl bg-white px-3 py-2 text-sm leading-relaxed text-neutral-700 ring-1 ring-neutral-200">
              {entry.notes}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeaderNav
          currentPage="jour"
          title="Suivi du jour"
          subtitle="Ajoute, consulte et ajuste les entrées de la date sélectionnée."
          rightSlot={
            <div className="flex flex-col items-center gap-2">
              <div className="grid grid-cols-[auto_auto_auto] items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setSelectedDate((prev) => shiftDateString(prev, -1))}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  ←
                </button>

                <div className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-neutral-700 ring-1 ring-neutral-200">
                  {formattedSelectedDate}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDate((prev) => shiftDateString(prev, 1))}
                  disabled={isTodaySelected}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
                >
                  →
                </button>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white"
              >
                Ajouter une entrée
              </button>
            </div>
          }
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps actif</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(activeSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Temps de pause</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {formatDurationFromSeconds(pauseSeconds)}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Entrées du jour</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {entries.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Secteur principal</p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-neutral-900">
              {topSectorName}
            </p>
            <p className="mt-2 text-sm text-neutral-500">
              {topSectorSeconds > 0
                ? formatDurationFromSeconds(topSectorSeconds)
                : "Aucun temps actif"}
            </p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-semibold text-neutral-900">Filtres</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Restreins l’affichage selon les tâches ou les tags.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Tâches
                </label>
                <select
                  value={selectedFilterSectorId}
                  onChange={(e) => setSelectedFilterSectorId(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                >
                  <option value="all">Toutes les tâches</option>
                  {availableSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                  <option value="pause">Pause</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Tags
                </label>
                <select
                  value={selectedFilterTagName}
                  onChange={(e) => setSelectedFilterTagName(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                >
                  <option value="all">Tous les tags</option>
                  {availableTags.map((tag) => (
                    <option key={tag.id} value={tag.name}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-semibold text-neutral-900">Tri / affichage</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Choisis comment organiser les entrées de la journée.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setDisplayMode("grouped")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${displayMode === "grouped"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300"
                  }`}
              >
                Regrouper par tâche
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode("chronological")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${displayMode === "chronological"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300"
                  }`}
              >
                Chronologique
              </button>

              <button
                type="button"
                onClick={() => setDisplayMode("duration")}
                className={`rounded-2xl px-4 py-3 text-sm font-medium ring-1 ${displayMode === "duration"
                    ? "bg-neutral-900 text-white ring-neutral-900"
                    : "bg-white text-neutral-700 ring-neutral-300"
                  }`}
              >
                Par durée
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-neutral-900">Entrées du jour</h2>
              {!loading && (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  {filteredEntries.length} entrée{filteredEntries.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {displayMode === "chronological" ? (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-neutral-700">
                  Ordre chronologique
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
                >
                  <option value="asc">Du plus ancien au plus récent</option>
                  <option value="desc">Du plus récent au plus ancien</option>
                </select>
              </div>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : filteredEntries.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">Aucune entrée pour ce filtre aujourd’hui.</p>
          ) : displayMode === "grouped" ? (
            <div className="mt-5 space-y-5">
              {groupedEntries.map((group) => (
                <div key={group.sectorId} className="space-y-3">
                  <div className="rounded-2xl bg-neutral-900 px-4 py-3 text-white">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: group.sectorColor }}
                        />
                        <p className="font-semibold">{group.sectorName}</p>
                      </div>
                      <p className="text-sm font-medium">
                        {formatDurationFromSeconds(group.totalSeconds)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {group.entries.map((entry) => renderEntryCard(entry))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {displayedEntries.map((entry) => renderEntryCard(entry))}
            </div>
          )}
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-neutral-900">
                  {editingEntryId ? "Modifier une entrée" : "Ajouter une entrée"}
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Ajoute ou modifie une plage de travail ou de pause pour aujourd’hui.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Fermer
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Tâche
                </label>
                <select
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  disabled={isPause}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                >
                  {availableSectors.map((sector) => (
                    <option key={sector.id} value={sector.id}>
                      {sector.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex. appel client, mails, admin..."
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Sous-tâche existante
                </label>
                <select
                  value={selectedSubTaskId}
                  onChange={(e) => setSelectedSubTaskId(e.target.value)}
                  disabled={isPause}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                >
                  <option value="">Aucune</option>
                  {filteredSubTasks.map((subTask) => (
                    <option key={subTask.id} value={subTask.id}>
                      {subTask.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Nouvelle sous-tâche
                </label>
                <input
                  type="text"
                  value={newSubTaskName}
                  onChange={(e) => setNewSubTaskName(e.target.value)}
                  disabled={isPause}
                  placeholder="Ex. relance client, tri des mails..."
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Heure de début
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Heure de fin
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-neutral-700">
                    Actions / quantités
                  </label>

                  <button
                    type="button"
                    onClick={addActionDraft}
                    disabled={isPause}
                    className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    Ajouter une action
                  </button>
                </div>

                {actionDrafts.length === 0 ? (
                  <p className="text-xs text-neutral-500">Aucune action ajoutée.</p>
                ) : (
                  <div className="space-y-3">
                    {actionDrafts.map((action, index) => (
                      <div
                        key={index}
                        className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-[1fr_160px_auto]"
                      >
                        <input
                          type="text"
                          value={action.actionType}
                          onChange={(e) =>
                            updateActionDraft(index, { actionType: e.target.value })
                          }
                          placeholder="Ex. appels, emails, dossiers"
                          disabled={isPause}
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                        />

                        <input
                          type="number"
                          min="1"
                          value={action.quantity}
                          onChange={(e) =>
                            updateActionDraft(index, { quantity: Number(e.target.value) || 0 })
                          }
                          disabled={isPause}
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none disabled:bg-neutral-100"
                        />

                        <button
                          type="button"
                          onClick={() => removeActionDraft(index)}
                          disabled={isPause}
                          className="rounded-full bg-red-100 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-200 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <label className="mb-2 block text-sm font-medium text-neutral-700">
                  Tags
                </label>

                {availableTags.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {availableTags.map((tag) => {
                      const isSelected = selectedTagNames.includes(tag.name);

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() =>
                            setSelectedTagNames((prev) =>
                              prev.includes(tag.name)
                                ? prev.filter((name) => name !== tag.name)
                                : [...prev, tag.name],
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${isSelected
                              ? "bg-neutral-900 text-white"
                              : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                            }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="Ajouter de nouveaux tags, séparés par des virgules"
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                />
                <p className="mt-2 text-xs text-neutral-500">
                  Tu peux sélectionner des tags existants ci-dessus ou en créer de nouveaux ici.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={isPause}
                  onChange={(e) => setIsPause(e.target.checked)}
                />
                Entrée de pause
              </label>

              <div className="flex flex-wrap gap-3">
                {editingEntryId ? (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Annuler
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleSaveEntry}
                  disabled={saving}
                  className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {editingEntryId ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <p className="mt-4 text-sm font-medium text-red-600">{errorMessage}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}