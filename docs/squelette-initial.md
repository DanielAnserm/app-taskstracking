# Squelette initial du projet technique – Outil de suivi du temps de travail

## 1. Objectif

Ce document fournit une base concrète pour démarrer le projet.

Il ne remplace pas encore le dépôt final, mais il donne :

- l’arborescence minimale ;
- les premiers fichiers à créer ;
- le contenu de départ recommandé ;
- l’ordre dans lequel poser les bases.

L’objectif est de pouvoir lancer rapidement un vrai projet React + TypeScript + Dexie propre.

---

## 2. Arborescence minimale recommandée

```text
src/
  app/
    App.tsx
    routes.tsx
  db/
    database.ts
  domain/
    timeTracking/
      aggregationService.ts
      entryService.ts
      sessionService.ts
  pages/
    HomePage.tsx
    DailyPage.tsx
    HistoryPage.tsx
    SettingsPage.tsx
  repositories/
    sectorRepository.ts
    sessionRepository.ts
    subTaskRepository.ts
    tagRepository.ts
    timeEntryRepository.ts
  types/
    domain.ts
    dto.ts
  utils/
    duration.ts
```

---

## 3. Fichiers à créer en premier

Ordre recommandé :

1. `src/types/domain.ts`
2. `src/db/database.ts`
3. `src/app/routes.tsx`
4. `src/app/App.tsx`
5. `src/pages/HomePage.tsx`
6. `src/repositories/timeEntryRepository.ts`
7. `src/repositories/sessionRepository.ts`
8. `src/domain/timeTracking/sessionService.ts`
9. `src/domain/timeTracking/entryService.ts`
10. `src/domain/timeTracking/aggregationService.ts`

---

## 4. Contenu de départ recommandé

## 4.1 `src/types/domain.ts`

```ts
export type EnergyLevel = "faible" | "moyen" | "bon" | "excellent";
export type EntrySource = "live" | "manual" | "imported";
export type SessionStatus = "running" | "paused" | "stopped";

export interface WorkSector {
  id: string;
  name: string;
  color: string;
  icon?: string;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubTask {
  id: string;
  sectorId: string;
  name: string;
  defaultActionType?: string;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  date: string;
  startAt: string;
  endAt: string;
  durationSeconds: number;
  sectorId: string;
  subTaskId?: string;
  energy?: EnergyLevel;
  notes?: string;
  source: EntrySource;
  isPause: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntryTag {
  id: string;
  timeEntryId: string;
  tagId: string;
}

export interface EntryAction {
  id: string;
  timeEntryId: string;
  actionType: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  id: string;
  sectorId: string;
  subTaskId?: string;
  startedAt: string;
  status: SessionStatus;
  pausedAt?: string;
  accumulatedPauseSeconds: number;
  energy?: EnergyLevel;
  notesDraft?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4.2 `src/types/dto.ts`

```ts
import type { ActiveSession, EntryAction, Tag, TimeEntry } from "./domain";

export interface TimeEntryDetailed extends TimeEntry {
  sectorName: string;
  sectorColor: string;
  subTaskName?: string;
  tags: Tag[];
  actions: EntryAction[];
}

export interface ActiveSessionDetailed extends ActiveSession {
  sectorName: string;
  sectorColor: string;
  subTaskName?: string;
  elapsedSeconds: number;
}
```

---

## 4.3 `src/db/database.ts`

```ts
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
```

---

## 4.4 `src/app/routes.tsx`

```ts
import { createBrowserRouter } from "react-router-dom";
import { DailyPage } from "../pages/DailyPage";
import { HistoryPage } from "../pages/HistoryPage";
import { HomePage } from "../pages/HomePage";
import { SettingsPage } from "../pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />,
  },
  {
    path: "/jour",
    element: <DailyPage />,
  },
  {
    path: "/historique",
    element: <HistoryPage />,
  },
  {
    path: "/parametres",
    element: <SettingsPage />,
  },
]);
```

---

## 4.5 `src/app/App.tsx`

```ts
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";

export default function App() {
  return <RouterProvider router={router} />;
}
```

---

## 4.6 `src/pages/HomePage.tsx`

```ts
export function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Outil de suivi du temps de travail</h1>
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-xl font-semibold">Écran principal</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Base de démarrage. Les composants métier seront branchés ici ensuite.
          </p>
        </section>
      </div>
    </main>
  );
}
```

---

## 4.7 `src/pages/DailyPage.tsx`

```ts
export function DailyPage() {
  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Suivi du jour</h1>
      </div>
    </main>
  );
}
```

---

## 4.8 `src/pages/HistoryPage.tsx`

```ts
export function HistoryPage() {
  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Historique</h1>
      </div>
    </main>
  );
}
```

---

## 4.9 `src/pages/SettingsPage.tsx`

```ts
export function SettingsPage() {
  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="text-2xl font-bold">Paramètres</h1>
      </div>
    </main>
  );
}
```

---

## 4.10 `src/repositories/timeEntryRepository.ts`

```ts
import { db } from "../db/database";
import type { TimeEntry } from "../types/domain";

export const timeEntryRepository = {
  async create(entry: TimeEntry): Promise<string> {
    await db.timeEntries.put(entry);
    return entry.id;
  },

  async update(entry: TimeEntry): Promise<void> {
    await db.timeEntries.put(entry);
  },

  async remove(id: string): Promise<void> {
    await db.timeEntries.delete(id);
  },

  async listByDate(date: string): Promise<TimeEntry[]> {
    return db.timeEntries.where("date").equals(date).sortBy("startAt");
  },
};
```

---

## 4.11 `src/repositories/sessionRepository.ts`

```ts
import { db } from "../db/database";
import type { ActiveSession } from "../types/domain";

export const sessionRepository = {
  async getCurrent(): Promise<ActiveSession | undefined> {
    const running = await db.activeSessions.where("status").equals("running").first();
    if (running) return running;
    return db.activeSessions.where("status").equals("paused").first();
  },

  async save(session: ActiveSession): Promise<void> {
    await db.activeSessions.put(session);
  },

  async remove(id: string): Promise<void> {
    await db.activeSessions.delete(id);
  },
};
```

---

## 4.12 `src/domain/timeTracking/sessionService.ts`

```ts
import { sessionRepository } from "../../repositories/sessionRepository";
import type { ActiveSession } from "../../types/domain";

export const sessionService = {
  async ensureNoOtherActiveSession(): Promise<void> {
    const current = await sessionRepository.getCurrent();
    if (current) {
      throw new Error("Une session est déjà active.");
    }
  },

  async start(session: ActiveSession): Promise<void> {
    await this.ensureNoOtherActiveSession();
    await sessionRepository.save(session);
  },
};
```

---

## 4.13 `src/domain/timeTracking/entryService.ts`

```ts
import { timeEntryRepository } from "../../repositories/timeEntryRepository";
import type { TimeEntry } from "../../types/domain";

export const entryService = {
  async createManualEntry(entry: TimeEntry): Promise<string> {
    return timeEntryRepository.create(entry);
  },

  async updateEntry(entry: TimeEntry): Promise<void> {
    await timeEntryRepository.update(entry);
  },
};
```

---

## 4.14 `src/domain/timeTracking/aggregationService.ts`

```ts
import { timeEntryRepository } from "../../repositories/timeEntryRepository";

export const aggregationService = {
  async getDailyTotals(date: string) {
    const entries = await timeEntryRepository.listByDate(date);

    const activeSeconds = entries
      .filter((entry) => !entry.isPause)
      .reduce((sum, entry) => sum + entry.durationSeconds, 0);

    const pauseSeconds = entries
      .filter((entry) => entry.isPause)
      .reduce((sum, entry) => sum + entry.durationSeconds, 0);

    return {
      activeSeconds,
      pauseSeconds,
      totalSeconds: activeSeconds + pauseSeconds,
      entryCount: entries.length,
    };
  },
};
```

---

## 4.15 `src/utils/duration.ts`

```ts
export function formatDurationFromSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}
```

---

## 5. Dépendances recommandées

Dépendances de base :

```bash
npm install react-router-dom dexie
npm install -D typescript @types/react @types/react-dom tailwindcss postcss autoprefixer
```

Si besoin ensuite :

```bash
npm install zustand recharts
```

---

## 6. Ordre exact de mise en place

### Étape 1

Créer le projet Vite React TypeScript.

### Étape 2

Configurer Tailwind.

### Étape 3

Créer `domain.ts`.

### Étape 4

Créer `database.ts` et vérifier que Dexie fonctionne.

### Étape 5

Créer les pages minimales et le routing.

### Étape 6

Créer les repositories de base.

### Étape 7

Créer `sessionService` et `entryService`.

### Étape 8

Brancher une première version de l’écran principal.

---

## 7. Ce que permet ce squelette

Une fois ce socle en place, on peut immédiatement commencer à coder :

- la session active ;
- la tâche active ;
- le suivi du jour ;
- l’ajout manuel ;
- l’historique simple.

---

## 8. Recommandation

La prochaine étape la plus logique est maintenant : **générer le vrai premier lot de fichiers de code prêts à coller dans un projet React/Vite**.

