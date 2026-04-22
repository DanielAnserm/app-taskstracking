import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sectorRepository } from "../repositories/sectorRepository";
import type { WorkSector } from "../types/domain";

interface DraftSector {
  name: string;
  color: string;
}

export function SettingsPage() {
  const [sectors, setSectors] = useState<WorkSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<DraftSector>({
    name: "",
    color: "#3b82f6",
  });

  async function loadSectors() {
    const allSectors = await sectorRepository.listAll();
    setSectors(allSectors);
    setLoading(false);
  }

  useEffect(() => {
    void loadSectors();
  }, []);

  async function handleCreateSector() {
    const trimmedName = draft.name.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const nextDisplayOrder =
        sectors.length > 0 ? Math.max(...sectors.map((sector) => sector.displayOrder)) + 1 : 1;

      const newSector: WorkSector = {
        id: crypto.randomUUID(),
        name: trimmedName,
        color: draft.color,
        icon: undefined,
        displayOrder: nextDisplayOrder,
        isActive: true,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };

      await sectorRepository.create(newSector);

      setDraft({
        name: "",
        color: "#3b82f6",
      });

      await loadSectors();
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
    await loadSectors();
  }

  async function handleToggleActive(sector: WorkSector) {
    await sectorRepository.setActive(sector.id, !sector.isActive);
    await loadSectors();
  }

  async function handleToggleArchived(sector: WorkSector) {
    if (sector.isArchived) {
      await sectorRepository.unarchive(sector.id);
    } else {
      await sectorRepository.archive(sector.id);
    }
    await loadSectors();
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
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
            Gestion simple des secteurs pour démarrer proprement la V1.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold text-neutral-900">Créer un secteur</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Ajoute un nouveau secteur disponible dans le démarrage d’une tâche.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <div>
              <label
                htmlFor="new-sector-name"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Nom
              </label>
              <input
                id="new-sector-name"
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex. Appels, Opérations, Suivis..."
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="new-sector-color"
                className="mb-2 block text-sm font-medium text-neutral-700"
              >
                Couleur
              </label>
              <input
                id="new-sector-color"
                type="color"
                value={draft.color}
                onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
                className="h-12 w-full rounded-2xl border border-neutral-300 bg-white px-2 py-2"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateSector}
              disabled={saving || !draft.name.trim()}
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
          ) : sectors.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">Aucun secteur disponible.</p>
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

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              sector.isActive
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"
                            }`}
                          >
                            {sector.isActive ? "Actif" : "Inactif"}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              sector.isArchived
                                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                : "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                            }`}
                          >
                            {sector.isArchived ? "Archivé" : "Visible"}
                          </span>

                          {isPauseSector ? (
                            <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-medium text-white">
                              Secteur système
                            </span>
                          ) : null}
                        </div>
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
                              onClick={() => void handleToggleActive(sector)}
                              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              {sector.isActive ? "Désactiver" : "Activer"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleToggleArchived(sector)}
                              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                            >
                              {sector.isArchived ? "Désarchiver" : "Archiver"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}