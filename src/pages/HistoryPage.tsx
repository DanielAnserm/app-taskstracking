import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { entryService } from "../domain/timeTracking/entryService";
import { db } from "../db/database";
import type { TimeEntry, WorkSector } from "../types/domain";
import { formatDurationFromSeconds } from "../utils/duration";

interface EntryWithSector extends TimeEntry {
  sector?: WorkSector;
}

type SortOrder = "asc" | "desc";

function toIsoForDate(date: string, time: string): string {
  return `${date}T${time}:00`;
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

export function HistoryPage() {
  const [entries, setEntries] = useState<EntryWithSector[]>([]);
  const [availableSectors, setAvailableSectors] = useState<WorkSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSectorId, setSelectedSectorId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [isPause, setIsPause] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadData() {
    const rawEntries = await db.timeEntries.toArray();
    const allSectors = await db.workSectors.toArray();

    const usableSectors = allSectors
      .filter((sector) => sector.isActive && !sector.isArchived && sector.id !== "pause")
      .sort((a, b) => a.displayOrder - b.displayOrder);

    const enrichedEntries = await Promise.all(
      rawEntries.map(async (entry) => {
        const sector = await db.workSectors.get(entry.sectorId);
        return {
          ...entry,
          sector,
        };
      }),
    );

    setEntries(enrichedEntries);
    setAvailableSectors(usableSectors);

    if (!selectedSectorId && usableSectors.length > 0) {
      setSelectedSectorId(usableSectors[0].id);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const sortedEntries = useMemo(() => {
    const copied = [...entries];

    copied.sort((a, b) => {
      const diff = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      return sortOrder === "asc" ? diff : -diff;
    });

    return copied;
  }, [entries, sortOrder]);

  const workEntries = entries.filter((entry) => !entry.isPause);
  const pauseEntries = entries.filter((entry) => entry.isPause);

  function resetForm() {
    setEditingEntryId(null);
    setEntryDate(new Date().toISOString().slice(0, 10));
    setStartTime("09:00");
    setEndTime("10:00");
    setNote("");
    setIsPause(false);
    setErrorMessage("");

    if (availableSectors.length > 0) {
      setSelectedSectorId(availableSectors[0].id);
    } else {
      setSelectedSectorId("");
    }
  }

  function handleEditEntry(entry: EntryWithSector) {
    setEditingEntryId(entry.id);
    setEntryDate(isoToDateInput(entry.startAt));
    setStartTime(isoToTimeInput(entry.startAt));
    setEndTime(isoToTimeInput(entry.endAt));
    setIsPause(entry.isPause);
    setSelectedSectorId(entry.isPause ? "" : entry.sectorId);
    setNote(entry.notes ?? "");
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDeleteEntry(id: string) {
    const confirmed = window.confirm("Supprimer cette entrée ?");
    if (!confirmed) return;

    setSaving(true);
    try {
      await entryService.deleteEntry(id);
      if (editingEntryId === id) {
        resetForm();
      }
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEntry() {
    setErrorMessage("");

    const effectiveSectorId = isPause ? "pause" : selectedSectorId;

    if (!effectiveSectorId) {
      setErrorMessage("Choisis un secteur.");
      return;
    }

    const startAt = toIsoForDate(entryDate, startTime);
    const endAt = toIsoForDate(entryDate, endTime);
    const durationSeconds = diffSeconds(startAt, endAt);

    if (durationSeconds <= 0) {
      setErrorMessage("L’heure de fin doit être après l’heure de début.");
      return;
    }

    if (!editingEntryId) {
      setErrorMessage("Sélectionne d’abord une entrée à modifier.");
      return;
    }

    setSaving(true);
    try {
      const existingEntry = entries.find((entry) => entry.id === editingEntryId);
      if (!existingEntry) {
        setErrorMessage("Entrée introuvable.");
        return;
      }

      const nowIso = new Date().toISOString();

      const updatedEntry: TimeEntry = {
        ...existingEntry,
        date: entryDate,
        startAt,
        endAt,
        durationSeconds,
        sectorId: effectiveSectorId,
        energy: isPause ? undefined : existingEntry.energy ?? "bon",
        notes: note.trim() || undefined,
        isPause,
        updatedAt: nowIso,
      };

      await entryService.updateEntry(updatedEntry);
      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
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
            Historique
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Vue simple de toutes les entrées enregistrées.
          </p>
        </div>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Modifier une entrée</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Sélectionne une entrée dans la liste ci-dessous, puis modifie-la ici.
              </p>
            </div>

            {editingEntryId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Annuler
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700">
                Secteur
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
              <label className="mb-2 block text-sm font-medium text-neutral-700">Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. appel client, mails, admin..."
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-900 outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={isPause}
                onChange={(e) => setIsPause(e.target.checked)}
              />
              Entrée de pause
            </label>

            <button
              type="button"
              onClick={handleSaveEntry}
              disabled={saving || !editingEntryId}
              className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>

          {errorMessage ? (
            <p className="mt-4 text-sm font-medium text-red-600">{errorMessage}</p>
          ) : null}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Total entrées</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {entries.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Travail</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {workEntries.length}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm font-medium text-neutral-500">Pauses</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
              {pauseEntries.length}
            </p>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-neutral-900">Toutes les entrées</h2>
              {!loading && (
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                  {sortedEntries.length} entrée{sortedEntries.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-neutral-700">
                Affichage
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none"
              >
                <option value="desc">Du plus récent au plus ancien</option>
                <option value="asc">Du plus ancien au plus récent</option>
              </select>
            </div>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-neutral-600">Chargement…</p>
          ) : sortedEntries.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-600">Aucune entrée enregistrée.</p>
          ) : (
            <div className="mt-5 space-y-3">
              {sortedEntries.map((entry) => {
                const isPauseEntry = entry.isPause;

                return (
                  <div
                    key={entry.id}
                    className={`rounded-2xl p-4 ring-1 ${
                      isPauseEntry
                        ? "bg-amber-50 ring-amber-200"
                        : "bg-neutral-50 ring-neutral-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                entry.sector?.color ?? (isPauseEntry ? "#f59e0b" : "#737373"),
                            }}
                          />
                          <p className="text-base font-semibold text-neutral-900">
                            {entry.sector?.name ?? entry.sectorId}
                          </p>
                        </div>

                        <p className="mt-1 text-sm text-neutral-600">
                          {new Date(entry.startAt).toLocaleDateString()} ·{" "}
                          {new Date(entry.startAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" – "}
                          {new Date(entry.endAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>

                        {entry.notes ? (
                          <p className="mt-3 text-sm text-neutral-700">{entry.notes}</p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                        <div className="text-left sm:text-right">
                          <p className="text-lg font-semibold text-neutral-900">
                            {formatDurationFromSeconds(entry.durationSeconds)}
                          </p>
                          <p
                            className={`mt-1 text-sm font-medium ${
                              isPauseEntry ? "text-amber-700" : "text-neutral-500"
                            }`}
                          >
                            {isPauseEntry ? "Pause" : "Travail"}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditEntry(entry)}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                          >
                            Modifier
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDeleteEntry(entry.id)}
                            className="rounded-full bg-red-100 px-3 py-2 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-200"
                          >
                            Supprimer
                          </button>
                        </div>
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