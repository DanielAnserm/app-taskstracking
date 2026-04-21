# Périmètre V1 final – Outil de suivi du temps de travail

## 1. Objectif

Ce document sert à figer ce qui entre réellement dans la **V1** du produit.

L’objectif est d’éviter :
- une V1 trop grosse ;
- un démarrage de développement flou ;
- des priorités contradictoires ;
- des fonctionnalités utiles mais non indispensables qui ralentiraient la sortie.

Le principe est simple :
- **V1 indispensable** = doit être codé dès la première version utilisable ;
- **V1.1 / ensuite** = utile, mais peut attendre ;
- **Plus tard** = intéressant, mais non prioritaire pour démarrer.

---

## 2. Proposition de découpage

## 2.1 V1 indispensable

### Socle produit
- application web locale ;
- fonctionnement sans hébergement obligatoire ;
- stockage local robuste ;
- structure de données stable ;
- navigation entre les vues principales.

### Gestion du temps
- une seule tâche active à la fois ;
- démarrage d’une tâche ;
- pause ;
- reprise ;
- arrêt ;
- changement de tâche ;
- saisie de l’énergie ;
- saisie d’actions / quantités ;
- création d’entrées de pause séparées.

### Écran principal
- **Tâche active** ;
- **Démarrage rapide** ;
- **Récap du jour** ;
- **Menu de navigation**.

### Données métier
- gestion des secteurs ;
- gestion des sous-tâches ;
- gestion des tags ;
- gestion des entrées de temps ;
- gestion des actions liées aux entrées.

### Vues de suivi
- **Suivi du jour** ;
- **Suivi hebdomadaire** ;
- **Suivi mensuel** ;
- **Vue d’ensemble**.

### Historique et édition
- historique / timeline ;
- modification d’une entrée ;
- ajout manuel d’une entrée.

### Graphiques indispensables
- anneau journalier ;
- calendrier hebdomadaire ;
- graphique mensuel combiné ;
- courbe de tendance globale ;
- répartition globale par secteur.

### Paramètres indispensables
- gestion des secteurs ;
- gestion des sous-tâches ;
- gestion des tags ;
- préférences d’affichage minimales.

---

## 2.2 V1.1 / ensuite

### Exports
- export CSV ;
- export Excel ;
- export texte IA.

### Sauvegarde
- export de sauvegarde ;
- import de sauvegarde.

### Confort d’usage
- PWA ;
- meilleure gestion offline ;
- raccourcis avancés ;
- duplication d’entrées si besoin confirmé ;
- filtres plus avancés.

### Stats avancées
- comparaisons plus fines ;
- tableaux analytiques supplémentaires ;
- vues croisées plus complexes.

---

## 2.3 Plus tard

### Synchronisation
- multi-appareils ;
- synchronisation cloud ;
- compte utilisateur ;
- sauvegarde automatique distante.

### Hébergement
- version en ligne ;
- partage entre appareils sans manipulation manuelle.

### Fonctions avancées
- objectifs de temps ;
- planification ;
- comparaison prévu / réel ;
- notifications ;
- automatisations.

---

## 3. Arbitrages proposés

## 3.1 Ce que je recommande de figer dans la V1

### À garder absolument
- Tâche active
- Démarrage rapide
- Récap du jour
- Suivi du jour
- Suivi hebdomadaire
- Suivi mensuel
- Vue d’ensemble
- Historique
- Paramètres de base
- stockage local
- graphiques principaux

### À sortir de la V1 si on veut aller plus vite
- exports avancés ;
- sauvegarde / import ;
- PWA ;
- stats trop détaillées ;
- raffinements secondaires de confort.

---

## 4. Proposition de périmètre V1 final

### V1 finale recommandée
- app web locale ;
- stockage local IndexedDB ;
- navigation principale complète ;
- écran principal complet ;
- session active complète ;
- ajout / édition manuelle ;
- suivi du jour ;
- suivi hebdomadaire ;
- suivi mensuel ;
- vue d’ensemble ;
- historique / timeline ;
- paramètres de base ;
- graphiques essentiels.

### Hors V1 recommandée
- exports ;
- sauvegarde / import ;
- synchronisation ;
- PWA ;
- hébergement ;
- fonctionnalités d’objectifs.

---

## 5. Questions à trancher ensemble

### Question 1
Est-ce que **Vue d’ensemble** reste bien dans la V1, ou est-ce qu’on la bascule en V1.1 pour alléger ?

**Décision validée** :
- **Vue d’ensemble reste dans la V1** ;
- mais sous une **forme allégée**.

Contenu retenu pour la V1 :
- cartes globales principales ;
- courbe de tendance globale ;
- répartition globale par secteur ;
- comparatifs simples ;
- noyau analytique limité.

### Question 2
Est-ce que **Historique / timeline** complet doit être en V1, ou seulement une version simple avec édition minimale ?

**Décision validée** :
- **Historique / timeline en V1** ;
- sous une **version simple**.

Contenu retenu pour la V1 :
- liste chronologique ;
- filtres minimaux ;
- modification d’une entrée ;
- ajout manuel.

### Question 3
Est-ce que les **statistiques très détaillées** du global doivent toutes être en V1, ou seulement le noyau principal ?

**Décision validée** :
- **noyau principal en V1** ;
- **statistiques détaillées en V1.1**.

Contenu retenu pour la V1 :
- temps total cumulé ;
- moyennes principales ;
- jours actifs ;
- travail / pause ;
- tendance globale ;
- répartition globale par secteur ;
- comparatifs simples ;
- éventuellement jours les plus productifs.

### Question 4
Est-ce que les **exports** doivent être exclus complètement de la V1 ?

**Décision validée** :
- **exports hors V1** ;
- déplacés en **V1.1**.

Exports concernés :
- CSV ;
- Excel ;
- texte IA ;
- export / import de sauvegarde plus tard.

## 6. Recommandation de départ

Ma recommandation actuelle est :

### V1
- toutes les vues principales ;
- **Vue d’ensemble allégée** ;
- **Historique / timeline simple mais réel** ;
- **noyau principal des stats globales** ;
- paramètres de base ;
- aucun export ;
- aucun cloud ;
- aucun hébergement obligatoire.

### V1.1
- exports ;
- sauvegarde ;
- statistiques globales détaillées ;
- améliorations avancées ;
- PWA.

---

## 7. Version à valider

### Périmètre V1 retenu
- application web locale ;
- stockage local robuste ;
- écran principal complet ;
- session active complète ;
- ajout / édition manuelle ;
- suivi du jour ;
- suivi hebdomadaire ;
- suivi mensuel ;
- **vue d’ensemble allégée** ;
- **historique / timeline simple** ;
- paramètres de base ;
- graphiques essentiels.

### Périmètre V1.1 retenu
- exports ;
- sauvegarde / import ;
- statistiques globales détaillées ;
- PWA ;
- raffinements avancés de confort.

### Hors périmètre
- synchronisation cloud ;
- multi-appareils natif ;
- hébergement obligatoire ;
- objectifs ;
- planification ;
- comparaison prévu / réel ;
- notifications ;
- automatisations.

