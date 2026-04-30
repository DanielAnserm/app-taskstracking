import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { aggregationService } from "../domain/timeTracking/aggregationService";
import { timeEntryRepository } from "../repositories/timeEntryRepository";
import { sessionService } from "../domain/timeTracking/sessionService";
import { db } from "../db/database";
import { subTaskRepository } from "../repositories/subTaskRepository";
import type { ActiveSession, SubTask, Tag, WorkSector } from "../types/domain";
import { formatDurationFromSeconds, formatTimer } from "../utils/duration";
import {
  validateSectorSubTaskConsistency,
  validateSelectedSector,
  validateSelectedTags,
  validateTypedSubTaskName,
} from "../utils/validation";

interface SectorChartSlice {
  sectorId: string;
  name: string;
  seconds: number;
  color: string;
  percentage: number;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTagInput(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function computeElapsedSeconds(session: ActiveSession, nowMs: number): number {
  const base = session.accumulatedActiveSeconds ?? 0;

  if (session.status === "running") {
    const segmentStart = session.segmentStartedAt ?? session.startedAt;
    const runningSeconds = Math.max(
      0,
      Math.floor((nowMs - new Date(segmentStart).getTime()) / 1000),
    );
    return base + runningSeconds;
  }

  return base;
}

function getSessionTitle(session: ActiveSession | undefined): string {
  if (!session) return "Démarrer une tâche";
  if (session.sectorId === "pause") return "Pause en cours";
  return "Tâche en cours";
}

function iconForQuickAction(kind: "pause" | "resume" | "stop" | "change") {
  if (kind === "pause") return "Ⅱ";
  if (kind === "resume") return "▶";
  if (kind === "stop") return "■";
  return "⇄";
}
function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");

  if (normalized.length !== 6) {
    return hex;
  }

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function HomePage() {
  const [currentSession, setCurrentSession] = useState<ActiveSession | undefined>(undefined);
  const [currentSector, setCurrentSector] = useState<WorkSector | undefined>(undefined);

  const [availableSectors, setAvailableSectors] = useState<WorkSector[]>([]);
  const [availableSubTasks, setAvailableSubTasks] = useState<SubTask[]>([]);
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);

  const [selectedSectorId, setSelectedSectorId] = useState("");
  const [selectedSubTaskId, setSelectedSubTaskId] = useState("");
  const [newSubTaskName, setNewSubTaskName] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [entryCount, setEntryCount] = useState(0);
  const [topSectorName, setTopSectorName] = useState("—");
  const [topSectorSeconds, setTopSectorSeconds] = useState(0);
  const [sectorChartData, setSectorChartData] = useState<SectorChartSlice[]>([]);

  const [loading, setLoading] = useState(true);
  const [clockMs, setClockMs] = useState(Date.now());
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSectorId, setEditSectorId] = useState("");
  const [editSelectedSubTaskId, setEditSelectedSubTaskId] = useState("");
  const [editNewSubTaskName, setEditNewSubTaskName] = useState("");
  const [editSelectedTagNames, setEditSelectedTagNames] = useState<string[]>([]);
  const [editNewTagInput, setEditNewTagInput] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editErrorMessage, setEditErrorMessage] = useState("");

  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [switchSectorId, setSwitchSectorId] = useState("");
  const [switchSelectedSubTaskId, setSwitchSelectedSubTaskId] = useState("");
  const [switchNewSubTaskName, setSwitchNewSubTaskName] = useState("");
  const [switchSelectedTagNames, setSwitchSelectedTagNames] = useState<string[]>([]);
  const [switchNewTagInput, setSwitchNewTagInput] = useState("");
  const [switchNote, setSwitchNote] = useState("");
  const [switchErrorMessage, setSwitchErrorMessage] = useState("");

  async function loadData() {
    const session = await sessionService.getCurrent();
    const today = todayDateString();
    const totals = await aggregationService.getDailyTotals(today);
    const dailyEntries = await timeEntryRepository.listByDate(today);

    const allSectors = await db.workSectors.toArray();
    const allSubTasksFromDb = await db.subTasks.toArray();
    const allTagsFromDb = await db.tags.toArray();

    const usableSectors = allSectors
      .filter((sector) => sector.isActive && !sector.isArchived && sector.id !== "pause")
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const usableSubTasks = allSubTasksFromDb
      .filter((subTask) => subTask.isActive && !subTask.isArchived)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const usableTags = allTagsFromDb
      .filter((tag) => tag.isActive && !tag.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    let sector: WorkSector | undefined;
    if (session) {
      sector = await db.workSectors.get(session.sectorId);
    }

    setCurrentSession(session);
    setCurrentSector(sector);
    setAvailableSectors(usableSectors);
    setAvailableSubTasks(usableSubTasks);
    setAllSubTasks(allSubTasksFromDb);
    setAvailableTags(usableTags);
    setAllTags(allTagsFromDb);

    setActiveSeconds(totals.activeSeconds);
    setPauseSeconds(totals.pauseSeconds);
    setEntryCount(totals.entryCount);

    const sectorBuckets = new Map<string, number>();

    for (const entry of dailyEntries) {
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
    const allSectorBuckets = new Map<string, number>();

    for (const entry of dailyEntries) {
      const current = allSectorBuckets.get(entry.sectorId) ?? 0;
      allSectorBuckets.set(entry.sectorId, current + entry.durationSeconds);
    }

    const totalDaySeconds = totals.activeSeconds + totals.pauseSeconds;

    if (allSectorBuckets.size === 0 || totalDaySeconds === 0) {
      setSectorChartData([]);
    } else {
      const chartData = Array.from(allSectorBuckets.entries())
        .map(([sectorId, seconds]) => {
          const matchingSector = allSectors.find((sector) => sector.id === sectorId);

          return {
            sectorId,
            name: matchingSector?.name ?? sectorId,
            seconds,
            color: matchingSector?.color ?? "#737373",
            percentage: Math.round((seconds / totalDaySeconds) * 1000) / 10,
          };
        })
        .sort((a, b) => b.seconds - a.seconds);

      setSectorChartData(chartData);
    }

    if (!selectedSectorId && usableSectors.length > 0) {
      setSelectedSectorId(usableSectors[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
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
  }, [selectedSectorId, selectedSubTaskId, availableSubTasks]);

  useEffect(() => {
    if (!editSectorId) {
      setEditSelectedSubTaskId("");
      return;
    }

    const matchingSubTasks = availableSubTasks.filter(
      (subTask) => subTask.sectorId === editSectorId,
    );

    if (matchingSubTasks.length === 0) {
      setEditSelectedSubTaskId("");
      return;
    }

    const stillValid = matchingSubTasks.some((subTask) => subTask.id === editSelectedSubTaskId);
    if (!stillValid) {
      setEditSelectedSubTaskId("");
    }
  }, [editSectorId, editSelectedSubTaskId, availableSubTasks]);

  useEffect(() => {
    if (!switchSectorId) {
      setSwitchSelectedSubTaskId("");
      return;
    }

    const matchingSubTasks = availableSubTasks.filter(
      (subTask) => subTask.sectorId === switchSectorId,
    );

    if (matchingSubTasks.length === 0) {
      setSwitchSelectedSubTaskId("");
      return;
    }

    const stillValid = matchingSubTasks.some((subTask) => subTask.id === switchSelectedSubTaskId);
    if (!stillValid) {
      setSwitchSelectedSubTaskId("");
    }
  }, [switchSectorId, switchSelectedSubTaskId, availableSubTasks]);

  const filteredSubTasks = useMemo(() => {
    if (!selectedSectorId) return [];
    return availableSubTasks.filter((subTask) => subTask.sectorId === selectedSectorId);
  }, [availableSubTasks, selectedSectorId]);

  const sectorsForDropdown = useMemo(() => {
    return [...availableSectors].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [availableSectors]);

  const filteredEditSubTasks = useMemo(() => {
    if (!editSectorId) return [];
    return availableSubTasks.filter((subTask) => subTask.sectorId === editSectorId);
  }, [availableSubTasks, editSectorId]);

  const filteredSwitchSubTasks = useMemo(() => {
    if (!switchSectorId) return [];
    return availableSubTasks.filter((subTask) => subTask.sectorId === switchSectorId);
  }, [availableSubTasks, switchSectorId]);

  const elapsedSeconds = useMemo(() => {
    if (!currentSession) return 0;
    return computeElapsedSeconds(currentSession, clockMs);
  }, [currentSession, clockMs]);

  const totalDaySeconds = activeSeconds + pauseSeconds;

  const isPauseSession = currentSession?.sectorId === "pause";
  const currentSubTask = currentSession?.subTaskId
    ? availableSubTasks.find((subTask) => subTask.id === currentSession.subTaskId)
    : undefined;

  function openEditModal() {
    if (!currentSession || isPauseSession) return;

    setEditSectorId(currentSession.sectorId);
    setEditSelectedSubTaskId(currentSession.subTaskId ?? "");
    setEditNewSubTaskName("");
    setEditSelectedTagNames(currentSession.tagNamesDraft ?? []);
    setEditNewTagInput("");
    setEditNote(currentSession.notesDraft ?? "");
    setEditErrorMessage("");
    setIsEditOpen(true);
  }

  function closeEditModal() {
    setIsEditOpen(false);
    setEditErrorMessage("");
  }

  function openSwitchModal() {
    if (!currentSession || isPauseSession) return;

    setSwitchSectorId(currentSession.sectorId);
    setSwitchSelectedSubTaskId("");
    setSwitchNewSubTaskName("");
    setSwitchSelectedTagNames([]);
    setSwitchNewTagInput("");
    setSwitchNote("");
    setSwitchErrorMessage("");
    setIsSwitchOpen(true);
  }

  function closeSwitchModal() {
    setIsSwitchOpen(false);
    setSwitchErrorMessage("");
  }

  async function handleSaveSessionEdits() {
    if (!currentSession || isPauseSession) return;

    setEditErrorMessage("");

    const sectorValidation = validateSelectedSector({
      sectorId: editSectorId,
      availableSectors,
      isPause: false,
    });

    if (!sectorValidation.isValid) {
      setEditErrorMessage(sectorValidation.error ?? "Tâche invalide.");
      return;
    }

    const typedTagNames = parseTagInput(editNewTagInput);
    const tagsValidation = validateSelectedTags({
      selectedTagNames: editSelectedTagNames,
      typedTagNames,
      availableTags,
      allTags,
    });

    if (!tagsValidation.isValid) {
      setEditErrorMessage(tagsValidation.error ?? "Tags invalides.");
      return;
    }

    const typedSubTaskValidation = validateTypedSubTaskName({
      sectorId: editSectorId,
      typedSubTaskName: editNewSubTaskName,
      allSubTasks,
      isPause: false,
    });

    if (!typedSubTaskValidation.isValid) {
      setEditErrorMessage(typedSubTaskValidation.error ?? "Sous-tâche invalide.");
      return;
    }

    setActionLoading(true);

    try {
      let resolvedSubTaskId: string | undefined = editSelectedSubTaskId || undefined;

      if (editNewSubTaskName.trim()) {
        const createdSubTask = await subTaskRepository.getOrCreateByName(
          editSectorId,
          editNewSubTaskName,
        );
        resolvedSubTaskId = createdSubTask.id;
      }

      const subTaskConsistency = validateSectorSubTaskConsistency({
        sectorId: editSectorId,
        subTaskId: resolvedSubTaskId,
        availableSubTasks,
        isPause: false,
      });

      if (!subTaskConsistency.isValid) {
        setEditErrorMessage(subTaskConsistency.error ?? "Sous-tâche invalide.");
        return;
      }

      await sessionService.update({
        ...currentSession,
        sectorId: editSectorId,
        subTaskId: resolvedSubTaskId,
        notesDraft: editNote.trim() || undefined,
        tagNamesDraft: [...editSelectedTagNames, ...typedTagNames],
        updatedAt: new Date().toISOString(),
      });

      closeEditModal();
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSwitchTask() {
    if (!currentSession || isPauseSession) return;

    setSwitchErrorMessage("");

    const sectorValidation = validateSelectedSector({
      sectorId: switchSectorId,
      availableSectors,
      isPause: false,
    });

    if (!sectorValidation.isValid) {
      setSwitchErrorMessage(sectorValidation.error ?? "Tâche invalide.");
      return;
    }

    const typedTagNames = parseTagInput(switchNewTagInput);
    const tagsValidation = validateSelectedTags({
      selectedTagNames: switchSelectedTagNames,
      typedTagNames,
      availableTags,
      allTags,
    });

    if (!tagsValidation.isValid) {
      setSwitchErrorMessage(tagsValidation.error ?? "Tags invalides.");
      return;
    }

    const typedSubTaskValidation = validateTypedSubTaskName({
      sectorId: switchSectorId,
      typedSubTaskName: switchNewSubTaskName,
      allSubTasks,
      isPause: false,
    });

    if (!typedSubTaskValidation.isValid) {
      setSwitchErrorMessage(typedSubTaskValidation.error ?? "Sous-tâche invalide.");
      return;
    }

    setActionLoading(true);

    try {
      let resolvedSubTaskId: string | undefined = switchSelectedSubTaskId || undefined;

      if (switchNewSubTaskName.trim()) {
        const createdSubTask = await subTaskRepository.getOrCreateByName(
          switchSectorId,
          switchNewSubTaskName,
        );
        resolvedSubTaskId = createdSubTask.id;
      }

      const subTaskConsistency = validateSectorSubTaskConsistency({
        sectorId: switchSectorId,
        subTaskId: resolvedSubTaskId,
        availableSubTasks,
        isPause: false,
      });

      if (!subTaskConsistency.isValid) {
        setSwitchErrorMessage(subTaskConsistency.error ?? "Sous-tâche invalide.");
        return;
      }

      await sessionService.stop(currentSession);

      const now = new Date().toISOString();
      const newSession: ActiveSession = {
        id: crypto.randomUUID(),
        sectorId: switchSectorId,
        subTaskId: resolvedSubTaskId,
        startedAt: now,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: 0,
        accumulatedActiveSeconds: 0,
        segmentStartedAt: now,
        energy: "bon",
        notesDraft: switchNote.trim() || undefined,
        tagNamesDraft: [...switchSelectedTagNames, ...typedTagNames],
        createdAt: now,
        updatedAt: now,
      };

      await sessionService.start(newSession);

      closeSwitchModal();
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePause() {
    if (!currentSession) return;

    setErrorMessage("");
    setActionLoading(true);

    try {
      await sessionService.pause(currentSession);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResume() {
    if (!currentSession) return;

    setErrorMessage("");
    setActionLoading(true);

    try {
      await sessionService.resume(currentSession);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    if (!currentSession) return;

    setErrorMessage("");
    setActionLoading(true);

    try {
      await sessionService.stop(currentSession);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartTask() {
    if (!selectedSectorId) return;

    setErrorMessage("");

    const sectorValidation = validateSelectedSector({
      sectorId: selectedSectorId,
      availableSectors,
      isPause: false,
    });

    if (!sectorValidation.isValid) {
      setErrorMessage(sectorValidation.error ?? "Tâche invalide.");
      return;
    }

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
      sectorId: selectedSectorId,
      typedSubTaskName: newSubTaskName,
      allSubTasks,
      isPause: false,
    });

    if (!typedSubTaskValidation.isValid) {
      setErrorMessage(typedSubTaskValidation.error ?? "Sous-tâche invalide.");
      return;
    }

    setActionLoading(true);

    try {
      const now = new Date().toISOString();
      const tagNames = [...selectedTagNames, ...typedTagNames];

      let resolvedSubTaskId: string | undefined = selectedSubTaskId || undefined;

      if (newSubTaskName.trim()) {
        const createdSubTask = await subTaskRepository.getOrCreateByName(
          selectedSectorId,
          newSubTaskName,
        );
        resolvedSubTaskId = createdSubTask.id;
      }

      const subTaskConsistency = validateSectorSubTaskConsistency({
        sectorId: selectedSectorId,
        subTaskId: resolvedSubTaskId,
        availableSubTasks,
        isPause: false,
      });

      if (!subTaskConsistency.isValid) {
        setErrorMessage(subTaskConsistency.error ?? "Sous-tâche invalide.");
        return;
      }

      const newSession: ActiveSession = {
        id: crypto.randomUUID(),
        sectorId: selectedSectorId,
        subTaskId: resolvedSubTaskId,
        startedAt: now,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: 0,
        accumulatedActiveSeconds: 0,
        segmentStartedAt: now,
        energy: "bon",
        notesDraft: draftNote.trim() || undefined,
        tagNamesDraft: tagNames,
        createdAt: now,
        updatedAt: now,
      };

      await sessionService.start(newSession);

      setDraftNote("");
      setSelectedSubTaskId("");
      setNewSubTaskName("");
      setSelectedTagNames([]);
      setNewTagInput("");

      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStartPause() {
    setErrorMessage("");
    setActionLoading(true);

    try {
      const now = new Date().toISOString();

      const pauseSession: ActiveSession = {
        id: crypto.randomUUID(),
        sectorId: "pause",
        subTaskId: undefined,
        startedAt: now,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: 0,
        accumulatedActiveSeconds: 0,
        segmentStartedAt: now,
        energy: undefined,
        notesDraft: draftNote.trim() || "Pause",
        tagNamesDraft: [],
        createdAt: now,
        updatedAt: now,
      };

      await sessionService.start(pauseSession);

      setDraftNote("");
      setSelectedSubTaskId("");
      setNewSubTaskName("");
      setSelectedTagNames([]);
      setNewTagInput("");

      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleQuickStartTask(sectorId: string) {
    setErrorMessage("");

    const sectorValidation = validateSelectedSector({
      sectorId,
      availableSectors,
      isPause: false,
    });

    if (!sectorValidation.isValid) {
      setErrorMessage(sectorValidation.error ?? "Tâche invalide.");
      return;
    }

    setActionLoading(true);

    try {
      const now = new Date().toISOString();

      const newSession: ActiveSession = {
        id: crypto.randomUUID(),
        sectorId,
        subTaskId: undefined,
        startedAt: now,
        status: "running",
        pausedAt: undefined,
        accumulatedPauseSeconds: 0,
        accumulatedActiveSeconds: 0,
        segmentStartedAt: now,
        energy: "bon",
        notesDraft: undefined,
        tagNamesDraft: [],
        createdAt: now,
        updatedAt: now,
      };

      await sessionService.start(newSession);

      setDraftNote("");
      setSelectedSubTaskId("");
      setNewSubTaskName("");
      setSelectedTagNames([]);
      setNewTagInput("");

      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
                Suivi du temps
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Écran principal de pilotage pour lancer, suivre et arrêter ton activité.
              </p>
            </div>

            <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm ring-1 ring-black/5">
              {new Date().toLocaleDateString("fr-CA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5 lg:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                    {getSessionTitle(currentSession)}
                  </h2>

                  {currentSession ? (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${isPauseSession
                        ? "bg-amber-50 text-amber-700 ring-amber-200"
                        : currentSession.status === "running"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200"
                        }`}
                    >
                      {isPauseSession
                        ? "Pause"
                        : currentSession.status === "running"
                          ? "En cours"
                          : "En pause"}
                    </span>
                  ) : (
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 ring-1 ring-neutral-200">
                      Aucune session active
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-neutral-600">
                  {currentSession
                    ? "Garde le contrôle sur ce qui tourne maintenant."
                    : ""}
                </p>
              </div>

              {currentSession ? (
                <div className="rounded-3xl bg-neutral-900 px-6 py-5 text-center text-white shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-white/70">
                    {isPauseSession ? "Temps de pause" : "Temps en cours"}
                  </p>
                  <p className="mt-2 text-5xl font-bold tracking-tight">
                    {formatTimer(elapsedSeconds)}
                  </p>
                </div>
              ) : null}
            </div>

            {loading ? (
              <p className="text-sm text-neutral-600">Chargement…</p>
            ) : currentSession ? (
              <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
                <div className="rounded-3xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-500">Tâche</p>
                      <div className="mt-3 flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: currentSector?.color ?? "#737373" }}
                        />
                        <p className="text-2xl font-semibold tracking-tight text-neutral-900">
                          {currentSector?.name ?? currentSession.sectorId}
                        </p>
                      </div>
                    </div>

                    {!isPauseSession ? (
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Modifier
                      </button>
                    ) : null}
                  </div>

                  {currentSubTask ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-neutral-600">
                        Sous-tâche : {currentSubTask.name}
                      </p>
                      {!isPauseSession ? (
                        <button
                          type="button"
                          onClick={openEditModal}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Modifier
                        </button>
                      ) : null}
                    </div>
                  ) : !isPauseSession ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-neutral-500">Aucune sous-tâche</p>
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  ) : null}

                  {currentSession.tagNamesDraft && currentSession.tagNamesDraft.length > 0 ? (
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        {currentSession.tagNamesDraft.map((tagName) => (
                          <span
                            key={tagName}
                            className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
                          >
                            {tagName}
                          </span>
                        ))}
                      </div>

                      {!isPauseSession ? (
                        <button
                          type="button"
                          onClick={openEditModal}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Modifier
                        </button>
                      ) : null}
                    </div>
                  ) : !isPauseSession ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-sm text-neutral-500">Aucun tag</p>
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  ) : null}

                  {currentSession.notesDraft ? (
                    <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                          Note
                        </p>
                        <p className="mt-2 text-sm text-neutral-700">
                          {currentSession.notesDraft}
                        </p>
                      </div>

                      {!isPauseSession ? (
                        <button
                          type="button"
                          onClick={openEditModal}
                          className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                        >
                          Modifier
                        </button>
                      ) : null}
                    </div>
                  ) : !isPauseSession ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                      <p className="text-sm text-neutral-500">Aucune note</p>
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                      >
                        Ajouter
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
                  <p className="text-sm font-medium text-neutral-500">Actions rapides</p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {!isPauseSession ? (
                      <>
                        {currentSession.status === "running" ? (
                          <button
                            type="button"
                            onClick={handlePause}
                            disabled={actionLoading}
                            className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl bg-amber-100 px-4 py-4 text-center ring-1 ring-amber-200 disabled:opacity-50"
                          >
                            <span className="text-2xl font-bold text-amber-800">
                              {iconForQuickAction("pause")}
                            </span>
                            <span className="mt-2 text-sm font-medium text-amber-800">
                              Mettre en pause
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResume}
                            disabled={actionLoading}
                            className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl bg-emerald-100 px-4 py-4 text-center ring-1 ring-emerald-200 disabled:opacity-50"
                          >
                            <span className="text-2xl font-bold text-emerald-800">
                              {iconForQuickAction("resume")}
                            </span>
                            <span className="mt-2 text-sm font-medium text-emerald-800">
                              Reprendre
                            </span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handleStop}
                          disabled={actionLoading}
                          className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl bg-red-100 px-4 py-4 text-center ring-1 ring-red-200 disabled:opacity-50"
                        >
                          <span className="text-2xl font-bold text-red-800">
                            {iconForQuickAction("stop")}
                          </span>
                          <span className="mt-2 text-sm font-medium text-red-800">
                            Arrêter la tâche
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={openSwitchModal}
                          disabled={actionLoading}
                          className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl bg-neutral-100 px-4 py-4 text-center ring-1 ring-neutral-200 disabled:opacity-50"
                        >
                          <span className="text-2xl font-bold text-neutral-800">
                            {iconForQuickAction("change")}
                          </span>
                          <span className="mt-2 text-sm font-medium text-neutral-800">
                            Changer de tâche
                          </span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStop}
                        disabled={actionLoading}
                        className="flex min-h-[96px] flex-col items-center justify-center rounded-3xl bg-red-100 px-4 py-4 text-center ring-1 ring-red-200 disabled:opacity-50"
                      >
                        <span className="text-2xl font-bold text-red-800">
                          {iconForQuickAction("stop")}
                        </span>
                        <span className="mt-2 text-sm font-medium text-red-800">
                          Terminer la pause
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-neutral-200">
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                      Démarrée à
                    </p>
                    <p className="mt-2 text-sm font-medium text-neutral-900">
                      {new Date(currentSession.startedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                  <div className="rounded-3xl bg-neutral-50 p-5 ring-1 ring-neutral-200">
                    <div className="grid gap-3.5">
                      <div>
                        <label
                          htmlFor="task"
                          className="mb-2 block text-base font-semibold text-neutral-800"
                        >
                          Tâche
                        </label>
                        <select
                          id="task"
                          value={selectedSectorId}
                          onChange={(e) => setSelectedSectorId(e.target.value)}
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3.5 text-base text-neutral-900 outline-none"
                        >
                          {sectorsForDropdown.map((sector) => (
                            <option key={sector.id} value={sector.id}>
                              {sector.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <label
                            htmlFor="subtask-existing"
                            className="mb-2 block text-sm font-medium text-neutral-700"
                          >
                            Sous-tâche existante
                          </label>
                          <select
                            id="subtask-existing"
                            value={selectedSubTaskId}
                            onChange={(e) => setSelectedSubTaskId(e.target.value)}
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none"
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
                          <label
                            htmlFor="new-subtask"
                            className="mb-2 block text-sm font-medium text-neutral-700"
                          >
                            Nouvelle sous-tâche
                          </label>
                          <input
                            id="new-subtask"
                            type="text"
                            value={newSubTaskName}
                            onChange={(e) => setNewSubTaskName(e.target.value)}
                            placeholder="Ex. relance client, tri des mails..."
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 md:items-start">
                        <div>
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
                        </div>

                        <div className="pt-[1.9rem]">
                          <label
                            htmlFor="note"
                            className="mb-2 block text-sm font-medium text-neutral-700"
                          >
                            Note
                          </label>
                          <input
                            id="note"
                            type="text"
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            placeholder="Ex. classement, suivi, appels..."
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                          />
                        </div>
                      </div>

                      {errorMessage ? (
                        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-neutral-50 p-3.5 ring-1 ring-neutral-200">
                    <div className="flex h-full min-h-[210px] flex-col justify-center gap-4">
                      <button
                        type="button"
                        onClick={handleStartTask}
                        disabled={actionLoading || !selectedSectorId}
                        className="rounded-3xl bg-emerald-100 px-7 py-4 text-base font-medium text-emerald-800 ring-1 ring-emerald-200 disabled:opacity-50"
                      >
                        Démarrer la tâche
                      </button>

                      <button
                        type="button"
                        onClick={handleStartPause}
                        disabled={actionLoading}
                        className="rounded-3xl bg-amber-100 px-7 py-4 text-base font-medium text-amber-800 ring-1 ring-amber-200 disabled:opacity-50"
                      >
                        Commencer une pause
                      </button>
                    </div>
                  </div>
                </div>

                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
                      Démarrage rapide
                    </h3>

                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {availableSectors.map((sector) => (
                      <button
                        key={sector.id}
                        type="button"
                        onClick={() => void handleQuickStartTask(sector.id)}
                        disabled={actionLoading}
                        className="rounded-[1.25rem] border px-5 py-6 text-center text-2xl font-semibold transition hover:-translate-y-[1px] disabled:opacity-50"
                        style={{
                          backgroundColor: hexToRgba(sector.color, 0.12),
                          borderColor: hexToRgba(sector.color, 0.35),
                          color: sector.color,
                        }}
                      >
                        {sector.name}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={handleStartPause}
                      disabled={actionLoading}
                      className="min-w-[280px] rounded-[1.4rem] border px-6 py-5 text-center text-2xl font-semibold transition hover:-translate-y-[1px] disabled:opacity-50"
                      style={{
                        backgroundColor: "rgba(202, 138, 4, 0.12)",
                        borderColor: "rgba(202, 138, 4, 0.35)",
                        color: "rgb(146, 64, 14)",
                      }}
                    >
                      Temps de pause
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                {entryCount}
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
          </div>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
                Répartition de la journée
              </h3>
              <p className="text-sm text-neutral-600">
                Temps total par tâche, pauses incluses.
              </p>
            </div>

            {sectorChartData.length === 0 ? (
              <p className="mt-5 text-sm text-neutral-600">
                Aucune donnée à afficher pour aujourd’hui.
              </p>
            ) : (
              <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
                <div className="mx-auto h-[340px] w-full max-w-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sectorChartData}
                        dataKey="seconds"
                        nameKey="name"
                        innerRadius={88}
                        outerRadius={128}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {sectorChartData.map((entry) => (
                          <Cell key={entry.sectorId} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none -mt-[205px] flex flex-col items-center justify-center text-center">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">
                      Total jour
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">
                      {formatDurationFromSeconds(totalDaySeconds)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {sectorChartData.map((item) => (
                    <div
                      key={item.sectorId}
                      className="rounded-xl bg-neutral-50 px-3 py-2.5 ring-1 ring-neutral-200"
                    >
                      <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <p className="truncate text-sm font-medium text-neutral-900">
                          {item.name}
                        </p>
                        <p className="text-sm font-semibold text-neutral-900">
                          {formatDurationFromSeconds(item.seconds)}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {item.percentage} %
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Navigation</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Accès rapide aux autres vues de la V1.
              </p>
            </div>
          </div>

          <nav className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/jour"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Suivi du jour
            </Link>

            <Link
              to="/hebdo"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Suivi hebdo
            </Link>

            <Link
              to="/mensuel"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Suivi mensuel
            </Link>

            <Link
              to="/global"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Vue globale
            </Link>

            <Link
              to="/parametres"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Paramètres
            </Link>

            <Link
              to="/historique"
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Historique
            </Link>
          </nav>
        </section>

        {isEditOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
                    Modifier la tâche en cours
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    Modifie la tâche, la sous-tâche, les tags et la note sans arrêter la session.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-6 grid gap-5">
                <div>
                  <label className="mb-2 block text-base font-semibold text-neutral-800">
                    Tâche
                  </label>
                  <select
                    value={editSectorId}
                    onChange={(e) => setEditSectorId(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-base text-neutral-900 outline-none"
                  >
                    {availableSectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Sous-tâche existante
                    </label>
                    <select
                      value={editSelectedSubTaskId}
                      onChange={(e) => setEditSelectedSubTaskId(e.target.value)}
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    >
                      <option value="">Aucune</option>
                      {filteredEditSubTasks.map((subTask) => (
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
                      value={editNewSubTaskName}
                      onChange={(e) => setEditNewSubTaskName(e.target.value)}
                      placeholder="Ex. relance client, tri des mails..."
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 md:items-start">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Tags
                    </label>

                    {availableTags.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {availableTags.map((tag) => {
                          const isSelected = editSelectedTagNames.includes(tag.name);

                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() =>
                                setEditSelectedTagNames((prev) =>
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
                      value={editNewTagInput}
                      onChange={(e) => setEditNewTagInput(e.target.value)}
                      placeholder="Ajouter de nouveaux tags, séparés par des virgules"
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Note
                    </label>
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Ex. classement, suivi, appels..."
                      className="mt-[2.3rem] w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    />
                  </div>
                </div>

                {editErrorMessage ? (
                  <p className="text-sm font-medium text-red-600">{editErrorMessage}</p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSessionEdits}
                    disabled={actionLoading}
                    className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {isSwitchOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight text-neutral-900">
                    Changer de tâche
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    La tâche actuelle sera arrêtée et enregistrée, puis la nouvelle tâche démarrera immédiatement.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeSwitchModal}
                  className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                >
                  Fermer
                </button>
              </div>

              <div className="mt-6 grid gap-5">
                <div>
                  <label className="mb-2 block text-base font-semibold text-neutral-800">
                    Nouvelle tâche
                  </label>
                  <select
                    value={switchSectorId}
                    onChange={(e) => setSwitchSectorId(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-base text-neutral-900 outline-none"
                  >
                    {availableSectors.map((sector) => (
                      <option key={sector.id} value={sector.id}>
                        {sector.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Sous-tâche existante
                    </label>
                    <select
                      value={switchSelectedSubTaskId}
                      onChange={(e) => setSwitchSelectedSubTaskId(e.target.value)}
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    >
                      <option value="">Aucune</option>
                      {filteredSwitchSubTasks.map((subTask) => (
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
                      value={switchNewSubTaskName}
                      onChange={(e) => setSwitchNewSubTaskName(e.target.value)}
                      placeholder="Ex. relance client, tri des mails..."
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 md:items-start">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Tags
                    </label>

                    {availableTags.length > 0 ? (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {availableTags.map((tag) => {
                          const isSelected = switchSelectedTagNames.includes(tag.name);

                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() =>
                                setSwitchSelectedTagNames((prev) =>
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
                      value={switchNewTagInput}
                      onChange={(e) => setSwitchNewTagInput(e.target.value)}
                      placeholder="Ajouter de nouveaux tags, séparés par des virgules"
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-neutral-700">
                      Note
                    </label>
                    <input
                      type="text"
                      value={switchNote}
                      onChange={(e) => setSwitchNote(e.target.value)}
                      placeholder="Ex. classement, suivi, appels..."
                      className="mt-[2.3rem] w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
                    />
                  </div>
                </div>

                {switchErrorMessage ? (
                  <p className="text-sm font-medium text-red-600">{switchErrorMessage}</p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeSwitchModal}
                    className="rounded-full border border-neutral-300 bg-white px-5 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchTask}
                    disabled={actionLoading}
                    className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Changer de tâche
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}