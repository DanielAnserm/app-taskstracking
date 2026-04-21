# Outil de suivi du temps de travail

Application web locale de suivi du temps de travail.

## Objectif

Construire une V1 locale permettant :

- une tâche active
- un suivi du jour
- un suivi hebdomadaire
- un suivi mensuel
- une vue d’ensemble allégée
- un historique simple
- un stockage local robuste

## Stack prévue

- React
- TypeScript
- Vite
- Tailwind CSS
- Dexie / IndexedDB

## Principes de la V1

- fonctionnement local, sans hébergement obligatoire
- une seule tâche active à la fois
- pauses stockées comme vraies entrées de temps
- ajout et modification manuelle possibles
- priorité à une base simple, robuste et utilisable au quotidien

## Documentation

Le dossier `docs/` contient les documents de cadrage et de préparation technique du projet :

- `architecture-technique-v1.md`  
  Architecture technique générale de la V1 : stack, structure des pages, stockage local, backlog.

- `perimetre-v1-final.md`  
  Définition de ce qui entre réellement dans la V1, ce qui passe en V1.1, et ce qui reste hors périmètre.

- `schema-donnees-v1.md`  
  Modèle de données de référence : entités métier, relations, règles de cohérence.

- `schema-dexie-typescript.md`  
  Structure Dexie détaillée, organisation TypeScript, repositories, services métier et découpage technique.

- `squelette-initial.md`  
  Base de départ recommandée pour le projet : arborescence, premiers fichiers, structure minimale.

- `plan-de-developpement-v1.md`  
  Plan de développement concret : MVP technique, ordre des développements, milestones et priorités.

## Statut

Le projet est actuellement en phase de cadrage et de préparation technique, avant le démarrage du code de la V1.
