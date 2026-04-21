# Plan de développement concret – V1 – Outil de suivi du temps de travail

## 1. Objectif

Ce document transforme le **périmètre V1 final** en plan de développement concret.

Il sert à répondre à 4 questions :
- dans quel ordre coder les écrans ;
- quel est le MVP technique minimum ;
- quelles sont les premières milestones réalistes ;
- comment avancer sans se disperser.

L’idée n’est pas de tout faire d’un coup, mais de construire une V1 solide, testable, puis améliorable.

---

## 2. Principes de développement

### 2.1 Règle principale
On code d’abord ce qui rend l’application **utilisable pour de vrai**, pas ce qui est seulement agréable ou impressionnant.

### 2.2 Priorité logique
Ordre recommandé :
1. faire fonctionner le **noyau métier** ;
2. rendre l’**écran principal** utilisable ;
3. rendre les **données consultables et modifiables** ;
4. ajouter les **vues analytiques** ;
5. raffiner ensuite l’expérience.

### 2.3 Ce qu’on évite
On évite de commencer par :
- les exports ;
- les raffinements visuels secondaires ;
- les stats avancées ;
- la PWA ;
- les optimisations trop tôt.

---

## 3. MVP technique minimum

## 3.1 Définition
Le MVP technique minimum est la version la plus petite possible qui permet déjà un usage réel.

## 3.2 Contenu du MVP technique

### Socle
- projet Vite + React + TypeScript ;
- Tailwind ;
- Dexie / IndexedDB ;
- routing simple ;
- structure de dossiers propre.

### Métier
- secteurs ;
- sous-tâches ;
- tags ;
- entrées de temps ;
- session active ;
- pause / reprise / arrêt ;
- ajout manuel ;
- modification d’une entrée.

### UI minimum
- écran principal ;
- tâche active ;
- démarrage rapide ;
- récap du jour ;
- navigation ;
- suivi du jour simple ;
- historique simple.

### Ce qui n’est pas dans le MVP minimum
- suivi hebdomadaire finalisé ;
- suivi mensuel finalisé ;
- vue d’ensemble ;
- exports ;
- stats détaillées.

---

## 4. Ordre exact recommandé des développements

## Étape 1 – Base projet
### Objectif
Avoir une base de code propre qui compile et navigue.

### À faire
- initialiser le projet ;
- configurer Tailwind ;
- configurer TypeScript ;
- créer l’arborescence ;
- poser les routes principales ;
- créer un layout global.

### Résultat attendu
Une app vide mais propre, navigable, prête à recevoir les vues.

---

## Étape 2 – Modèle de données et stockage
### Objectif
Poser le vrai socle métier.

### À faire
- définir les types ;
- créer le schéma Dexie ;
- gérer secteurs ;
- gérer sous-tâches ;
- gérer tags ;
- gérer entrées de temps ;
- gérer actions ;
- gérer session active.

### Résultat attendu
Les données peuvent être créées, lues, mises à jour, supprimées localement.

---

## Étape 3 – Noyau du chrono
### Objectif
Avoir le cœur fonctionnel du produit.

### À faire
- démarrer une tâche ;
- mettre en pause ;
- reprendre ;
- arrêter ;
- changer de tâche ;
- créer les entrées correspondantes ;
- créer les pauses séparément ;
- gérer l’énergie ;
- gérer les actions / quantités.

### Résultat attendu
Le suivi du temps fonctionne réellement.

---

## Étape 4 – Écran principal
### Objectif
Avoir une page d’accueil réellement utilisable.

### À faire
- carte **Tâche active** ;
- grille **Démarrage rapide** ;
- **Récap du jour** ;
- **Menu de navigation**.

### Résultat attendu
L’utilisateur peut lancer, suivre et arrêter ses tâches depuis une vue centrale.

---

## Étape 5 – Suivi du jour
### Objectif
Pouvoir consulter et corriger la journée.

### À faire
- cartes du jour ;
- filtres simples ;
- tri ;
- liste détaillée ;
- modification d’entrée ;
- ajout manuel.

### Résultat attendu
La journée est relisible et corrigeable.

---

## Étape 6 – Historique simple
### Objectif
Rendre les données exploitables dans le temps.

### À faire
- vue chronologique ;
- filtre par date ;
- filtre par secteur ;
- édition simple.

### Résultat attendu
L’utilisateur peut retrouver et corriger ses anciennes entrées.

---

## Étape 7 – Paramètres de base
### Objectif
Permettre de personnaliser le système.

### À faire
- CRUD secteurs ;
- CRUD sous-tâches ;
- CRUD tags ;
- préférences UI minimales.

### Résultat attendu
L’application devient configurable selon l’usage réel.

---

## Étape 8 – Suivi hebdomadaire
### Objectif
Ajouter la lecture agenda de la semaine.

### À faire
- cartes hebdo ;
- filtres ;
- tri / affichage ;
- calendrier continu ;
- blocs proportionnels à la durée ;
- légende.

### Résultat attendu
La semaine devient lisible visuellement.

---

## Étape 9 – Suivi mensuel
### Objectif
Ajouter la lecture synthétique du mois.

### À faire
- cartes mensuelles ;
- filtres ;
- tri / affichage ;
- graphique colonnes + courbe ;
- légende ;
- blocs complémentaires simples.

### Résultat attendu
Le mois est lisible à un niveau analytique intermédiaire.

---

## Étape 10 – Vue d’ensemble allégée
### Objectif
Ajouter une lecture globale sans surcharger la V1.

### À faire
- indicateurs cumulés ;
- courbe de tendance principale ;
- répartition globale par secteur ;
- comparatifs simples ;
- noyau analytique réduit.

### Résultat attendu
L’utilisateur a une lecture globale utile sans entrer dans les stats avancées.

---

## 5. Milestones recommandées

## Milestone 1 – Socle vivant
### Contenu
- base projet ;
- layout ;
- routes ;
- Dexie branché ;
- types définis.

### But
Valider que la base est saine.

---

## Milestone 2 – Chrono réellement fonctionnel
### Contenu
- session active ;
- pause / reprise / arrêt ;
- création d’entrées ;
- stockage local ;
- écran principal minimal.

### But
Pouvoir utiliser l’app pour suivre du temps réellement.

---

## Milestone 3 – Journée exploitable
### Contenu
- suivi du jour ;
- historique simple ;
- édition ;
- ajout manuel.

### But
Pouvoir corriger et relire les données.

---

## Milestone 4 – V1 de travail complète
### Contenu
- écran principal ;
- suivi du jour ;
- historique ;
- paramètres ;
- hebdo ;
- mensuel.

### But
Avoir une vraie V1 utilisable au quotidien.

---

## Milestone 5 – V1 finalisée
### Contenu
- vue d’ensemble allégée ;
- finitions UI ;
- stabilisation ;
- tests Safari / Apple.

### But
Avoir la V1 figée et propre.

---

## 6. Risques principaux

## 6.1 Risque de surcharge
Vouloir mettre trop de stats dans la V1 trop tôt.

### Réponse
Rester fidèle au périmètre V1 validé.

---

## 6.2 Risque technique
Mélanger trop tôt logique métier et interface.

### Réponse
Bien séparer :
- données ;
- logique métier ;
- UI.

---

## 6.3 Risque UX
Construire des vues riches sans vérifier leur utilité réelle.

### Réponse
Tester rapidement avec vraies données dès les premières milestones.

---

## 7. Ce qu’on peut améliorer encore avant le code

Avant de coder, on peut encore préciser :
- le schéma exact des types TypeScript ;
- l’arborescence des routes ;
- la structure Dexie détaillée ;
- les calculs de stats prioritaires ;
- la liste exacte des composants.

---

## 8. Recommandation finale

La meilleure stratégie maintenant est :

### D’abord
- figer le plan ;
- figer les types ;
- figer la structure Dexie.

### Ensuite
- coder la base du projet ;
- coder le chrono ;
- coder l’écran principal ;
- coder le suivi du jour.

### Puis
- compléter progressivement hebdo, mensuel, vue d’ensemble.

---

## 9. Prochaine étape recommandée

La prochaine étape la plus utile est de produire :
**le schéma de données définitif V1**

C’est le document qui réduira le plus les erreurs avant de commencer le vrai code.

