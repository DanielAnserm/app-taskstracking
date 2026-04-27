import type { SubTask, Tag, TimeEntry, WorkSector } from "../types/domain";

export interface TimeRangeValidationResult {
  isValid: boolean;
  error?: string;
}

export interface OverlapValidationResult {
  hasOverlap: boolean;
  conflictingEntries: TimeEntry[];
  error?: string;
}
export interface EntityValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ActionDraftValidationResult {
  isValid: boolean;
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

export function validateSelectedSector(params: {
  sectorId: string;
  availableSectors: WorkSector[];
  isPause: boolean;
}): EntityValidationResult {
  if (params.isPause) {
    return { isValid: true };
  }

  const matchingSector = params.availableSectors.find(
    (sector) => sector.id === params.sectorId,
  );

  if (!matchingSector) {
    return {
      isValid: false,
      error: "Le secteur sélectionné est introuvable.",
    };
  }

  if (!matchingSector.isActive || matchingSector.isArchived) {
    return {
      isValid: false,
      error: "Le secteur sélectionné n’est plus disponible.",
    };
  }

  return { isValid: true };
}

export function validateSelectedTags(params: {
  selectedTagNames: string[];
  typedTagNames?: string[];
  availableTags: Tag[];
  allTags?: Tag[];
}): EntityValidationResult {
  const availableTagNames = new Set(params.availableTags.map((tag) => tag.name));

  const invalidSelectedTag = params.selectedTagNames.find(
    (tagName) => !availableTagNames.has(tagName),
  );

  if (invalidSelectedTag) {
    return {
      isValid: false,
      error: `Le tag "${invalidSelectedTag}" n’est plus disponible.`,
    };
  }

  const typedTagNames = params.typedTagNames ?? [];
  const allTags = params.allTags ?? params.availableTags;

  for (const typedTagName of typedTagNames) {
    const normalizedTypedName = typedTagName.trim().toLowerCase();
    if (!normalizedTypedName) continue;

    const existingTag = allTags.find(
      (tag) => tag.name.trim().toLowerCase() === normalizedTypedName,
    );

    if (existingTag && (!existingTag.isActive || existingTag.isArchived)) {
      return {
        isValid: false,
        error: `Le tag "${typedTagName}" existe déjà mais n’est plus disponible.`,
      };
    }
  }

  return { isValid: true };
}

export function validateActionDrafts(
  actions: Array<{ actionType: string; quantity: number }>,
): ActionDraftValidationResult {
  for (const action of actions) {
    const hasType = action.actionType.trim().length > 0;
    const hasQuantity = Number.isFinite(Number(action.quantity)) && Number(action.quantity) > 0;

    if (!hasType && !hasQuantity) {
      continue;
    }

    if (!hasType) {
      return {
        isValid: false,
        error: "Une action a une quantité mais pas de type.",
      };
    }

    if (!hasQuantity) {
      return {
        isValid: false,
        error: `L’action "${action.actionType}" doit avoir une quantité supérieure à 0.`,
      };
    }
  }

  return { isValid: true };
}