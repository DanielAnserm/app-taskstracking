# Architecture technique V1 – Outil de suivi du temps de travail

## 1. Objectif de cette architecture

Ce document traduit le CDC et les maquettes validées en une première architecture technique réaliste pour une **V1 locale**, sans dépendance obligatoire à un hébergement payant.

L’objectif est de définir :
- la stack technique recommandée ;
- la structure des pages ;
- la structure des données ;
- la stratégie de stockage local ;
- le backlog de développement par ordre de priorité.

Cette V1 est pensée pour être :
- utilisable en local ;
- simple à maintenir ;
- évolutive ;
- suffisamment solide pour un usage réel quotidien.

---

## 2. Principes directeurs de la V1

### 2.1 Contraintes assumées
La V1 doit :
- fonctionner sans hébergement obligatoire ;
- pouvoir être utilisée depuis un seul appareil au départ ;
- privilégier la rapidité et la fiabilité plutôt que la sophistication ;
- permettre un futur passage vers une synchronisation ou un hébergement si nécessaire.

### 2.2 Orientation recommandée
La meilleure approche pour la V1 est une **application web locale**, responsive, avec stockage local robuste.

### 2.3 Résultat attendu
La V1 doit permettre :
- de suivre son temps en direct ;
- de corriger ses entrées ;
- de consulter les vues jour / semaine / mois ;
- de visualiser les statistiques principales ;
- d’exporter ses données plus tard.

---

## 3. Stack technique recommandée

### 3.1 Front-end
**React + TypeScript**

Pourquoi :
- très adapté aux interfaces découpées en composants ;
- excellent pour une application riche avec plusieurs vues ;
- TypeScript permet de sécuriser la structure des données ;
- très bon écosystème pour graphiques, stockage local et UI.

### 3.2 Outil de build
**Vite**

Pourquoi :
- simple ;
- rapide ;
- léger ;
- très adapté à une app locale moderne.

### 3.3 UI / design system
**Tailwind CSS**

Pourquoi :
- rapide pour construire l’interface ;
- très adapté aux ajustements fréquents ;
- cohérent avec les maquettes déjà construites.

### 3.4 Composants UI
Option recommandée :
- composants maison légers pour les blocs métiers ;
- éventuellement base de composants type shadcn/ui pour certains contrôles standards.

### 3.5 Graphiques
**Recharts**

Pourquoi :
- bien adapté aux graphiques React ;
- suffisant pour les vues jour / semaine / mois ;
- plus simple à intégrer qu’une solution très lourde.

### 3.6 Gestion d’état
Pour la V1, approche simple recommandée :
- **state local React** pour l’UI ;
- **context** ou petit store léger pour l’état global.

Options possibles :
- React Context
- Zustand

Recommandation V1 : **Zustand** ou **Context + hooks**.

### 3.7 Base de données locale
**IndexedDB** via une couche d’abstraction.

Pourquoi :
- plus robuste que localStorage ;
- mieux adapté à des volumes de données croissants ;
- permet de stocker des entrées structurées.

Bibliothèque recommandée :
- **Dexie.js**

Pourquoi Dexie :
- simplifie fortement IndexedDB ;
- très bon compromis entre puissance et simplicité.

### 3.8 Packaging local
Deux options réalistes :
- application web lancée localement dans le navigateur ;
- PWA ensuite si souhaité.

Recommandation V1 initiale :
- **web locale d’abord** ;
- PWA en deuxième étape si nécessaire.

---

## 4. Stack V1 recommandée – synthèse

### Recommandation principale
- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Dexie.js
- Zustand ou Context API

### Pourquoi cette stack est cohérente
Elle permet de :
- construire vite ;
- garder du code lisible ;
- travailler localement ;
- évoluer plus tard sans tout refaire.

---

## 5. Structure des pages

## 5.1 Vue générale
La V1 peut être organisée autour des pages / vues suivantes :

1. **Écran principal**
2. **Suivi du jour**
3. **Suivi hebdomadaire**
4. **Suivi mensuel**
5. **Vue d’ensemble**
6. **Historique / timeline**
7. **Paramètres**
8. **Exports**

Certaines pages peuvent partager des composants communs.

### 5.2 Écran principal
Contient :
- Tâche active
- Démarrage rapide
- Récap du jour
- Menu de navigation

### 5.3 Suivi du jour
Contient :
- date consultée ;
- cartes synthétiques ;
- filtres ;
- tri ;
- liste détaillée des entrées.

### 5.4 Suivi hebdomadaire
Contient :
- période ;
- cartes synthétiques ;
- filtres ;
- affichage calendrier ;
- légende.

### 5.5 Suivi mensuel
Contient :
- mois consulté ;
- cartes synthétiques ;
- filtres ;
- tri / affichage ;
- graphique principal ;
- blocs analytiques complémentaires.

### 5.6 Vue d’ensemble
Cette page sert à consolider les indicateurs globaux et à faire ressortir les tendances majeures.

Contient :
- indicateurs cumulés ;
- courbe de tendance globale ;
- répartition globale par secteur ;
- comparatifs globaux ;
- jours les plus productifs ;
- périodes les plus productives ;
- périodes creuses ;
- évolution de l’énergie moyenne ;
- répartition par jour de la semaine ;
- top sous-tâches / top tags ;
- régularité / dispersion ;
- temps moyen par session ;
- nombre moyen de changements de tâche par jour.

### 5.7 Historique / timeline
Contient :
- liste chronologique ;
- édition ;
- filtres ;
- ajout manuel.

### 5.8 Paramètres
Contient :
- secteurs ;
- sous-tâches ;
- tags ;
- préférences ;
- comportement de l’application.

### 5.9 Exports
Contiendra plus tard :
- export CSV ;
- export Excel ;
- export texte ;
- éventuellement import.

---

## 6. Structure de navigation recommandée

### 6.1 Navigation principale
Entrées validées :
- Suivi du jour
- Suivi hebdo
- Suivi mensuel
- Vue d’ensemble

### 6.2 Navigation secondaire
Accès complémentaires :
- Historique
- Paramètres
- Exports

### 6.3 Point d’entrée
L’application peut s’ouvrir sur :
- l’écran principal

Puis permettre la navigation vers les vues de suivi détaillées.

---

## 7. Structure des composants

### 7.1 Composants transversaux
Exemples :
- AppLayout
- NavigationMenu
- StatCard
- FilterBlock
- ViewSwitch
- LegendBlock
- EmptyState
- ConfirmDialog

### 7.2 Composants métier
Exemples :
- ActiveTaskCard
- QuickStartGrid
- DailyRecapChart
- DayEntryCard
- WeeklyCalendarView
- MonthlyActivityChart
- GlobalTrendChart
- GlobalSectorPieChart
- ProductivityHighlights
- SessionStatsCard
- ActionInputInline
- TaskEditModal

### 7.3 Intérêt de ce découpage
Ce découpage permet :
- de réutiliser les blocs ;
- de limiter la taille des pages ;
- de corriger une vue sans casser les autres.

---

## 8. Structure des données

### 8.1 Principes
Le modèle de données doit :
- rester simple ;
- séparer les entités métier ;
- permettre les requêtes par période ;
- gérer les entrées manuelles et live.

### 8.2 Entités principales

#### WorkSector
Champs proposés :
- id
- name
- color
- icon
- displayOrder
- isActive
- isArchived
- createdAt
- updatedAt

#### SubTask
Champs proposés :
- id
- sectorId
- name
- defaultActionType
- displayOrder
- isActive
- isArchived
- createdAt
- updatedAt

#### Tag
Champs proposés :
- id
- name
- color
- description
- isActive
- isArchived
- createdAt
- updatedAt

#### TimeEntry
Champs proposés :
- id
- date
- startAt
- endAt
- durationSeconds
- sectorId
- subTaskId
- energy
- notes
- source
- isPause
- createdAt
- updatedAt

#### TimeEntryTag
Champs proposés :
- id
- timeEntryId
- tagId

#### EntryAction
Champs proposés :
- id
- timeEntryId
- actionType
- quantity
- createdAt
- updatedAt

#### ActiveSession
Champs proposés :
- id
- sectorId
- subTaskId
- startedAt
- status
- pausedAt
- accumulatedPauseSeconds
- energy
- notesDraft

### 8.3 Enum utiles

#### EnergyLevel
Valeurs :
- faible
- moyen
- bon
- excellent

#### EntrySource
Valeurs :
- live
- manual
- imported

#### SessionStatus
Valeurs :
- running
- paused
- stopped

### 8.4 Représentation des pauses
Deux approches possibles :

#### Option simple
Créer une vraie entrée de type pause.

#### Option plus technique
Conserver les segments de pause dans la session active et générer une entrée finale.

### Recommandation V1
La solution la plus simple et fiable est :
- **créer une entrée pause dédiée**.

Pourquoi :
- plus simple à relire ;
- plus simple à agréger ;
- plus simple à exporter ;
- plus simple à debugger.

---

## 9. Index et requêtes locales

### 9.1 Requêtes fréquentes à prévoir
- entrées d’un jour ;
- entrées d’une semaine ;
- entrées d’un mois ;
- entrées par secteur ;
- entrées avec tag donné ;
- pauses ;
- actions liées à une entrée.

### 9.2 Index recommandés
Pour **TimeEntry** :
- date
- startAt
- sectorId
- subTaskId
- isPause

Pour **TimeEntryTag** :
- timeEntryId
- tagId

Pour **EntryAction** :
- timeEntryId
- actionType

---

## 10. Stratégie de stockage local

### 10.1 Recommandation principale
**IndexedDB via Dexie.js**

### 10.2 Pourquoi ne pas utiliser seulement localStorage
localStorage est trop limité pour :
- requêter facilement ;
- stocker proprement plusieurs entités ;
- maintenir une app qui grossit.

### 10.3 Ce qui peut rester dans localStorage
On peut garder dans localStorage uniquement :
- préférences UI légères ;
- dernière vue ouverte ;
- filtres récents ;
- thème ou options d’affichage.

### 10.4 Ce qui doit aller dans IndexedDB
- secteurs ;
- sous-tâches ;
- tags ;
- entrées de temps ;
- actions ;
- sessions ;
- historiques utiles.

### 10.5 Sauvegarde locale
Pour limiter les risques, la V1 devra plus tard permettre :
- export manuel de sauvegarde ;
- réimport manuel.

---

## 11. Architecture logique recommandée

### 11.1 Couches proposées

#### UI layer
- pages
- composants visuels
- formulaires
- modales

#### State layer
- état de navigation
- filtres actifs
- session active
- vue courante

#### Data layer
- accès Dexie
- fonctions CRUD
- agrégations locales

#### Domain layer
- logique métier du chrono
- logique de pause
- calculs journaliers / hebdo / mensuels
- règles d’agrégation

### 11.2 Intérêt
Cette séparation permet de :
- tester plus facilement ;
- faire évoluer le stockage ;
- garder une logique claire.

---

## 12. Logique métier centrale à coder

### 12.1 Session active
Règles :
- une seule session active à la fois ;
- changement de tâche avec confirmation ;
- création d’une entrée à la fin de la session ;
- pause comptée séparément.

### 12.2 Entrées manuelles
Règles :
- création a posteriori ;
- édition complète ;
- ajout de tags et d’actions.

### 12.3 Agrégations
À calculer localement :
- totaux par jour ;
- totaux par semaine ;
- totaux par mois ;
- secteurs dominants ;
- travail vs pause ;
- moyennes ;
- jours les plus productifs ;
- plages horaires les plus productives ;
- plages horaires creuses hors repas ;
- énergie moyenne par période ;
- répartition par jour de la semaine ;
- top sous-tâches ;
- top tags ;
- temps moyen par session ;
- nombre moyen de changements de tâche par jour ;
- indicateurs de régularité / dispersion.

### 12.4 Graphiques
Les vues devront être capables de produire :
- anneau journalier ;
- calendrier hebdo ;
- graphique mensuel combiné ;
- courbe de tendance globale ;
- graphique en anneau / fromage pour la répartition globale des tâches.

---

## 13. Backlog de développement – ordre de priorité

## Phase 1 – socle technique
1. Initialiser le projet Vite + React + TypeScript
2. Installer Tailwind
3. Installer Dexie
4. Mettre en place la structure de dossiers
5. Mettre en place le système de navigation entre vues
6. Définir les types TypeScript du domaine

## Phase 2 – stockage local et logique métier de base
7. Créer le schéma Dexie
8. Implémenter le CRUD des secteurs
9. Implémenter le CRUD des sous-tâches
10. Implémenter le CRUD des tags
11. Implémenter le CRUD des entrées de temps
12. Implémenter les actions liées aux entrées
13. Implémenter la session active
14. Gérer pause / reprise / arrêt / changement

## Phase 3 – écran principal
15. Construire le layout principal
16. Construire la carte **Tâche active**
17. Construire **Démarrage rapide**
18. Construire **Récap du jour**
19. Construire le **Menu de navigation**

## Phase 4 – Suivi du jour
20. Construire la page **Suivi du jour**
21. Construire les cartes synthétiques du jour
22. Construire les blocs **Filtres** et **Tri**
23. Construire la liste détaillée des entrées
24. Implémenter la modification d’une entrée

## Phase 5 – Suivi hebdomadaire
25. Construire la page **Suivi hebdo**
26. Construire les cartes synthétiques hebdo
27. Construire le calendrier continu hebdo
28. Implémenter le positionnement des blocs selon durée
29. Implémenter la légende

## Phase 6 – Suivi mensuel
30. Construire la page **Suivi mensuel**
31. Construire les cartes synthétiques mensuelles
32. Construire le graphique combiné colonnes + courbe
33. Implémenter la légende des tâches
34. Implémenter le repérage des semaines
35. Construire les blocs analytiques complémentaires

## Phase 7 – Vue d’ensemble
36. Construire la page **Vue d’ensemble**
37. Construire les cartes d’indicateurs cumulés
38. Construire la courbe de tendance globale
39. Construire la répartition globale par secteur avec graphique en anneau
40. Construire les comparatifs globaux
41. Construire les blocs analytiques complémentaires
42. Implémenter les agrégations transversales

## Phase 8 – historique et paramètres
43. Construire la vue **Historique / timeline**
44. Construire la vue **Paramètres**
45. Gérer les préférences locales

## Phase 9 – exports
46. Construire les exports CSV
47. Construire les exports Excel
48. Construire l’export texte IA
49. Prévoir un export/import de sauvegarde

---

## 14. Arborescence projet recommandée

Exemple :

```text
src/
  app/
  components/
    layout/
    shared/
    tracking/
    charts/
  pages/
  store/
  db/
  domain/
  hooks/
  utils/
  types/
```

---

## 15. Recommandation de mise en œuvre

### Recommandation V1 réaliste
Construire une première version avec :
- navigation locale ;
- données locales ;
- pas d’authentification ;
- pas de backend ;
- pas d’hébergement nécessaire.

### Résultat
Cette V1 pourra :
- fonctionner réellement ;
- être testée immédiatement ;
- être améliorée ensuite sans refonte totale.

---

## 16. Compatibilité Apple / Safari / PWA

### 16.1 Compatibilité Apple
L’architecture retenue est compatible avec l’écosystème Apple dans un cadre web standard.

Compatibilités visées :
- utilisation locale sur **macOS** via navigateur ;
- utilisation sur **iPhone / iPad** via Safari ;
- possibilité d’évolution vers une **PWA**.

### 16.2 Compatibilité macOS
La stack retenue fonctionne sans difficulté particulière sur Mac :
- développement local ;
- exécution de l’application ;
- build local ;
- tests navigateur.

### 16.3 Compatibilité Safari
La V1 devra être testée explicitement sur Safari, notamment pour :
- le stockage local ;
- le comportement d’IndexedDB ;
- la persistance des données ;
- les comportements offline éventuels ;
- les spécificités d’affichage responsive.

### 16.4 IndexedDB et Apple
IndexedDB est compatible avec Safari moderne, mais doit être validé en conditions réelles sur :
- Safari macOS ;
- Safari iPhone ;
- Safari iPad.

Conclusion pratique :
- la stratégie **Dexie + IndexedDB** reste pertinente ;
- des tests Apple / Safari doivent être intégrés tôt dans le projet.

### 16.5 PWA
Une évolution en PWA est envisageable après la V1.

Intérêts :
- ajout à l’écran d’accueil ;
- expérience plus proche d’une application ;
- usage plus direct sur mobile.

### 16.6 Limites à garder en tête
La compatibilité Apple est réaliste, mais il faut prévoir :
- des tests spécifiques Safari ;
- une validation du comportement du stockage local ;
- une attention particulière à l’expérience mobile.

## 17. Points à compléter ensuite

À compléter dans la suite du projet :
- statistiques avancées ;
- exports détaillés ;
- stratégie de sauvegarde ;
- éventuelle synchronisation multi-appareils ;
- éventuelle version PWA.

---

## 18. Décision technique provisoire recommandée

Si on devait figer un choix maintenant, la recommandation la plus solide serait :

- **Front** : React + TypeScript + Vite
- **Style** : Tailwind CSS
- **Stockage local** : Dexie / IndexedDB
- **Graphiques** : Recharts
- **État global** : Zustand
- **Déploiement initial** : local uniquement

C’est aujourd’hui l’option la plus cohérente avec tout ce qui a été défini.

