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

- `perimetre-v1-final.md`  
  Définit ce qui entre réellement dans la V1, ce qui passe en V1.1, et ce qui reste hors périmètre.

- `architecture-technique-v1.md`  
  Présente l’architecture technique générale de la V1 : stack, structure des pages, stockage local et backlog.

- `nettoyage-final-cdc-architecture.md`  
  Vérifie et harmonise les documents principaux du projet pour assurer leur cohérence avant le développement.

- `plan-de-developpement-v1.md`  
  Donne le plan de développement concret : MVP technique, ordre des développements, milestones et priorités.

- `schema-dexie-typescript.md`  
  Décrit la structure Dexie détaillée, l’organisation TypeScript, les repositories, les services métier et le découpage technique.

- `schema-donnees-v1.md`  
  Définit le modèle de données de référence : entités métier, relations et règles de cohérence.

- `squelette-initial.md`  
  Propose la base de départ du projet : arborescence, premiers fichiers et structure minimale recommandée.

## Statut

Le projet est actuellement en phase de cadrage et de préparation technique, avant le démarrage du code de la V1.