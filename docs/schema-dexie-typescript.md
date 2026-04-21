# Schéma Dexie détaillé + structure TypeScript – Outil de suivi du temps de travail

## 1. Objectif

Ce document transforme le schéma de données V1 en base de travail directement exploitable pour le développement.

Il sert à :

- définir la structure Dexie concrète ;
- fixer le découpage des fichiers TypeScript ;
- clarifier où placer les types, la base locale et la logique métier ;
- éviter les improvisations pendant le code.

---

## 2. Principe général

La logique recommandée est de séparer clairement :

- les **types** ;
- la **base locale Dexie** ;
- les **repositories / accès aux données** ;
- la **logique métier** ;
- les **composants UI**.

Objectif :

- garder un code lisible ;
- éviter de mélanger interface et persistance ;
- rendre le projet plus simple à faire évoluer.

---

## 3. Structure de dossiers recommandée

```text
src/
  app/
    App.tsx
    routes.tsx
  components/
    layout/
    shared/
    tracking/
    charts/
  pages/
    HomePage.tsx
    DailyPage.tsx
    WeeklyPage.tsx
    MonthlyPage.tsx
    OverviewPage.tsx
    HistoryPage.tsx
    SettingsPage.tsx
  db/
    database.ts
    schema.ts
    seed.ts
  repositories/
    sectorRepository.ts
    subTaskRepository.ts
    tagRepository.ts
    timeEntryRepository.ts
    actionRepository.ts
    sessionRepository.ts
  domain/
    timeTracking/
      sessionService.ts
      pauseService.ts
      entryService.ts
      aggregationService.ts
      statsService.ts
  store/
    uiStore.ts
    sessionStore.ts
    filterStore.ts
  hooks/
    useActiveSession.ts
    useDailyEntries.ts
    useWeeklyData.ts
    useMonthlyData.ts
    useOverviewData.ts
  types/
    domain.ts
    dto.ts
    ui.ts
  utils/
    date.ts
    duration.ts
    ids.ts
    validation.ts
```

---

## 4. Fichiers TypeScript à figer

## 4.1 `src/types/domain.ts`

Contient les types métier principaux :

- `EnergyLevel`
- `EntrySource`
- `SessionStatus`
- `WorkSector`
- `SubTask`
- `Tag`
- `TimeEntry`
- `TimeEntryTag`
- `EntryAction`
- `ActiveSession`

### Rôle

C’est la référence métier principale du projet.

---

## 4.2 `src/types/dto.ts`

Contient les objets enrichis ou dérivés, par exemple :

- `TimeEntryDetailed`
- `ActiveSessionDetailed`
- `DailyStats`
- `WeeklyStats`
- `MonthlyStats`
- `OverviewStats`

### Rôle

Séparer les types persistés des types calculés pour l’UI.

---

## 4.3 `src/types/ui.ts`

Contient les types purement liés à l’interface, par exemple :

- options de filtres ;
- états d’affichage ;
- modes de tri ;
- états de modales.

---

## 4.4 `src/db/schema.ts`

Contient :

- le nom de la base ;
- sa version ;
- les tables ;
- les index Dexie.

---

## 4.5 `src/db/database.ts`

Contient la classe Dexie principale.

### Rôle

Centraliser la configuration de la base.

---

## 4.6 `src/repositories/*`

Chaque repository gère une table ou une famille d’accès.

Exemples :

- `sectorRepository.ts`
- `timeEntryRepository.ts`
- `sessionRepository.ts`

### Rôle

Éviter d’écrire du Dexie brut partout dans l’application.

---

## 4.7 `src/domain/timeTracking/*`

Contient la vraie logique métier.

Exemples :

- démarrer une session ;
- mettre en pause ;
- reprendre ;
- arrêter ;
- créer une entrée finale ;
- calculer les stats ;
- transformer les données pour les vues.

---

## 5. Schéma Dexie détaillé

## 5.1 Nom de la base

Nom recommandé :

```ts
const DB_NAME = "time_tracking_v1";
```

---

## 5.2 Version initiale

```ts
const DB_VERSION = 1;
```

---

## 5.3 Tables

### workSectors

Champs indexés recommandés :

```ts
"id, name, displayOrder, isActive, isArchived"
```

### subTasks

Champs indexés recommandés :

```ts
"id, sectorId, name, displayOrder, isActive, isArchived"
```

### tags

Champs indexés recommandés :

```ts
"id, name, isActive, isArchived"
```

### timeEntries

Champs indexés recommandés :

```ts
"id, date, startAt, endAt, sectorId, subTaskId, isPause, source, [date+sectorId], [date+isPause]"
```

### timeEntryTags

Champs indexés recommandés :

```ts
"id, timeEntryId, tagId, [timeEntryId+tagId]"
```

### entryActions

Champs indexés recommandés :

```ts
"id, timeEntryId, actionType"
```

### activeSessions

Champs indexés recommandés :

```ts
"id, status, startedAt, sectorId, subTaskId"
```

---

## 5.4 Classe Dexie recommandée

```ts
import Dexie, { Table } from "dexie";
import {
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
      timeEntries: "id, date, startAt, endAt, sectorId, subTaskId, isPause, source, [date+sectorId], [date+isPause]",
      timeEntryTags: "id, timeEntryId, tagId, [timeEntryId+tagId]",
      entryActions: "id, timeEntryId, actionType",
      activeSessions: "id, status, startedAt, sectorId, subTaskId",
    });
  }
}

export const db = new TimeTrackingDatabase();
```

---

## 6. Repositories recommandés

## 6.1 `sectorRepository.ts`

Responsabilités :

- créer un secteur ;
- lister les secteurs actifs ;
- archiver un secteur ;
- réordonner les secteurs.

---

## 6.2 `subTaskRepository.ts`

Responsabilités :

- créer une sous-tâche ;
- lister par secteur ;
- archiver ;
- réordonner.

---

## 6.3 `tagRepository.ts`

Responsabilités :

- créer un tag ;
- lister les tags ;
- archiver un tag.

---

## 6.4 `timeEntryRepository.ts`

Responsabilités :

- créer une entrée ;
- modifier une entrée ;
- supprimer / archiver si prévu ;
- lister les entrées d’un jour ;
- lister les entrées d’une semaine ;
- lister les entrées d’un mois ;
- lister les pauses ;
- lister par secteur.

---

## 6.5 `actionRepository.ts`

Responsabilités :

- créer une action ;
- lister les actions d’une entrée ;
- mettre à jour ou supprimer une action.

---

## 6.6 `sessionRepository.ts`

Responsabilités :

- récupérer la session active ;
- créer une session ;
- mettre à jour le statut ;
- supprimer la session à la clôture si souhaité.

---

## 7. Services métier recommandés

## 7.1 `sessionService.ts`

Responsabilités :

- démarrer une session ;
- vérifier qu’aucune autre session n’est active ;
- changer de tâche ;
- arrêter proprement ;
- transformer la session en entrée de temps.

---

## 7.2 `pauseService.ts`

Responsabilités :

- mettre en pause ;
- reprendre ;
- calculer le temps de pause cumulé ;
- créer l’entrée pause correspondante si nécessaire.

---

## 7.3 `entryService.ts`

Responsabilités :

- créer une entrée manuelle ;
- modifier une entrée ;
- gérer les tags liés ;
- gérer les actions liées.

---

## 7.4 `aggregationService.ts`

Responsabilités :

- calculs jour / semaine / mois ;
- travail vs pause ;
- temps par secteur ;
- temps par sous-tâche ;
- temps par tag.

---

## 7.5 `statsService.ts`

Responsabilités :

- jours les plus productifs ;
- périodes productives ;
- périodes creuses ;
- énergie moyenne ;
- temps moyen par session ;
- changements de tâche ;
- comparatifs globaux.

---

## 8. Hooks recommandés

## 8.1 Hooks de lecture

- `useActiveSession()`
- `useDailyEntries(date)`
- `useWeeklyEntries(date)`
- `useMonthlyEntries(date)`
- `useOverviewStats(filters)`

## 8.2 Hooks métier

- `useStartSession()`
- `usePauseSession()`
- `useResumeSession()`
- `useStopSession()`
- `useSaveManualEntry()`

---

## 9. Utilitaires à prévoir

## 9.1 `date.ts`

Fonctions :

- début / fin de jour ;
- début / fin de semaine ;
- début / fin de mois ;
- formatage des dates.

## 9.2 `duration.ts`

Fonctions :

- secondes vers durée lisible ;
- durée compacte ;
- calculs d’écarts.

## 9.3 `ids.ts`

Fonctions :

- génération d’IDs stables.

## 9.4 `validation.ts`

Fonctions :

- validation des entrées ;
- validation des sessions ;
- garde-fous métier.

---

## 10. Schéma de fichiers recommandé pour démarrer vite

### Minimum de départ

```text
src/
  app/
    App.tsx
    routes.tsx
  db/
    database.ts
  types/
    domain.ts
    dto.ts
  domain/timeTracking/
    sessionService.ts
    entryService.ts
    aggregationService.ts
  repositories/
    timeEntryRepository.ts
    sessionRepository.ts
    sectorRepository.ts
    subTaskRepository.ts
    tagRepository.ts
  pages/
    HomePage.tsx
    DailyPage.tsx
    HistoryPage.tsx
    SettingsPage.tsx
```

### Intérêt

Commencer simple, puis ajouter hebdo / mensuel / global sans refaire la base.

---

## 11. Décisions techniques déjà suffisamment stables

On peut considérer comme figé pour le démarrage :

- React + TypeScript + Vite ;
- Tailwind ;
- Dexie / IndexedDB ;
- types métier décrits dans `domain.ts` ;
- repositories séparés ;
- services métier séparés ;
- une seule session active à la fois ;
- pauses stockées comme vraies entrées.

---

## 12. Points à confirmer encore

## 12.1 ID

Format à choisir :

- `crypto.randomUUID()`
- ou helper maison

### Recommandation

`crypto.randomUUID()` si disponible.

## 12.2 Suppression

Décider si les entrées peuvent être :

- réellement supprimées ;
- ou seulement archivées / marquées.

### Recommandation

Pour la V1 :

- suppression réelle tolérée pour les entrées ;
- archivage préféré pour secteurs / sous-tâches / tags.

## 12.3 Secteur pause

Décider si la pause est :

- un vrai secteur visible ;
- ou un type technique caché.

### Recommandation

Pour la V1 :

- secteur visible `Pause`, plus simple pour l’UI et les graphiques.

---

## 13. Prochaine étape recommandée

La prochaine étape la plus utile est maintenant : **générer le squelette initial du projet technique**

Concrètement :

- `domain.ts`
- `database.ts`
- structure Dexie
- repositories de base
- routes principales
- layout vide

