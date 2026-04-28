import { useEffect, useState } from "react";
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

export function SettingsPage() {
  const [sectors, setSectors] = useState<WorkSector[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetMode, setResetMode] = useState<"tracking" | "full" | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

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