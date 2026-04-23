import type { SubTask, TimeEntry } from "../types/domain";

export interface TimeRangeValidationResult {
  isValid: boolean;
  error?: string;
}

export interface OverlapValidationResult {
  hasOverlap: boolean;
  conflictingEntries: TimeEntry[];
  error?: string;
}

export function validateTimeRange(startIso: string, endIso: string): TimeRangeValidationResult {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return {
      isValid: false,
      error: "Les horaires sont invalides.",
    };
  }

  if (endMs <= startMs) {
    return {
      isValid: false,
      error: "L’heure de fin doit être après l’heure de début.",
    };
  }

  return {
    isValid: true,
  };
}

export function findOverlappingEntries(
  entries: TimeEntry[],
  candidate: {
    startAt: string;
    endAt: string;
    date: string;
    excludeEntryId?: string;
  },
): OverlapValidationResult {
  const candidateStart = new Date(candidate.startAt).getTime();
  const candidateEnd = new Date(candidate.endAt).getTime();

  const conflictingEntries = entries.filter((entry) => {
    if (entry.date !== candidate.date) return false;
    if (candidate.excludeEntryId && entry.id === candidate.excludeEntryId) return false;

    const entryStart = new Date(entry.startAt).getTime();
    const entryEnd = new Date(entry.endAt).getTime();

    return candidateStart < entryEnd && candidateEnd > entryStart;
  });

  if (conflictingEntries.length > 0) {
    return {
      hasOverlap: true,
      conflictingEntries,
      error: "Cette plage horaire chevauche une autre entrée existante.",
    };
  }

  return {
    hasOverlap: false,
    conflictingEntries: [],
  };
}

export function validateSectorSubTaskConsistency(params: {
  sectorId: string;
  subTaskId?: string;
  availableSubTasks: SubTask[];
  isPause: boolean;
}): TimeRangeValidationResult {
  if (params.isPause) {
    return { isValid: true };
  }

  if (!params.subTaskId) {
    return { isValid: true };
  }

  const matchingSubTask = params.availableSubTasks.find(
    (subTask) => subTask.id === params.subTaskId,
  );

  if (!matchingSubTask) {
    return {
      isValid: false,
      error: "La sous-tâche sélectionnée est introuvable.",
    };
  }

  if (matchingSubTask.sectorId !== params.sectorId) {
    return {
      isValid: false,
      error: "La sous-tâche sélectionnée ne correspond pas au secteur choisi.",
    };
  }

  return {
    isValid: true,
  };
}