# Nettoyage final CDC + architecture – Outil de suivi du temps de travail

## 1. Objectif

Ce document sert à vérifier et harmoniser les deux références principales du projet :
- le **CDC fonctionnel** ;
- l’**architecture technique V1**.

L’objectif est de s’assurer que :
- les vues portent les mêmes noms ;
- les mêmes sections sont prévues dans les deux documents ;
- les mêmes priorités apparaissent ;
- les mêmes composants et besoins techniques sont couverts ;
- il ne reste pas de contradictions bloquantes avant le prototype.

---

## 2. État général

### Conclusion globale
À ce stade, le projet est **globalement cohérent**.

Le CDC et l’architecture racontent bien la même chose sur les points principaux :
- V1 locale ;
- écran principal ;
- suivi du jour ;
- suivi hebdomadaire ;
- suivi mensuel ;
- vue d’ensemble ;
- historique ;
- paramètres ;
- futur export.

Il reste surtout un travail d’**harmonisation fine**, pas une refonte.

---

## 3. Alignement des noms de vues

### Référence à conserver
Les noms de vues à utiliser de façon stable sont :
- **Écran principal**
- **Suivi du jour**
- **Suivi hebdomadaire**
- **Suivi mensuel**
- **Vue d’ensemble**
- **Historique / timeline**
- **Paramètres**
- **Exports**

### Remarque
Le terme **Suivi hebdo** peut rester dans l’interface comme libellé court, mais le nom de référence dans les documents doit être :
**Suivi hebdomadaire**.

---

## 4. Alignement des sections fonctionnelles

## 4.1 Écran principal
### Éléments alignés
Les deux documents couvrent bien :
- **Tâche active** ;
- **Démarrage rapide** ;
- **Récap du jour** ;
- **Menu de navigation**.

### Décision à conserver
Ordre vertical validé :
1. **Tâche active**
2. **Démarrage rapide**
3. **Récap du jour**
4. **Menu de navigation**

---

## 4.2 Suivi du jour
### Éléments alignés
Le CDC et l’architecture couvrent bien :
- l’en-tête avec date ;
- les cartes synthétiques ;
- les filtres ;
- le tri ;
- la liste détaillée des entrées ;
- l’édition rapide.

### Point à conserver
Le **Temps actif** doit rester défini comme :
**temps de travail hors pauses**.

---

## 4.3 Suivi hebdomadaire
### Éléments alignés
Le CDC et l’architecture couvrent bien :
- les cartes synthétiques ;
- les filtres ;
- le tri / affichage ;
- la vue calendrier ;
- la légende ;
- les blocs proportionnels à la durée.

### Points structurants à conserver
- grille continue de type agenda ;
- heures de hauteur uniforme ;
- jours de largeur cohérente ;
- blocs de tâches dimensionnés selon leur durée ;
- informations secondaires masquées si le bloc est trop court.

---

## 4.4 Suivi mensuel
### Éléments alignés
Le CDC et l’architecture couvrent bien :
- cartes synthétiques mensuelles ;
- filtres ;
- tri / affichage ;
- graphique combiné ;
- répartition par secteur ;
- lecture par semaine.

### Points structurants à conserver
- colonnes empilées par tâches ;
- courbe de tendance ;
- repérage des semaines ;
- légende des tâches ;
- lecture travail / pause.

---

## 4.5 Vue d’ensemble
### Éléments alignés
Le CDC et l’architecture couvrent bien :
- indicateurs globaux ;
- tendance longue ;
- répartition globale ;
- comparatifs ;
- blocs analytiques complémentaires.

### Sections complémentaires à conserver
- **Jours les plus productifs** ;
- **Périodes les plus productives** ;
- **Périodes creuses** ;
- **Évolution de l’énergie moyenne** ;
- **Répartition par jour de la semaine** ;
- **Top sous-tâches / top tags** ;
- **Régularité / dispersion** ;
- **Temps moyen par session** ;
- **Nombre moyen de changements de tâche par jour**.

---

## 5. Alignement CDC / architecture sur la technique

## 5.1 Stack
### Alignement validé
La stack retenue est cohérente avec le CDC :
- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Dexie / IndexedDB
- Zustand ou équivalent léger

### Décision à conserver
La V1 reste pensée comme une **application locale**, sans backend obligatoire.

---

## 5.2 Stockage local
### Alignement validé
Le besoin fonctionnel du CDC est bien couvert par :
- IndexedDB pour les données métier ;
- localStorage pour les préférences légères.

### Point à conserver
Les pauses doivent rester gérables comme **entrées dédiées** pour simplifier calculs, lecture et export.

---

## 5.3 Graphiques
### Alignement validé
Les besoins du CDC sont techniquement couverts par l’architecture :
- anneau journalier ;
- calendrier hebdomadaire ;
- graphique mensuel combiné ;
- courbe de tendance globale ;
- anneau global de répartition.

---

## 5.4 Agrégations métier
### Alignement validé
L’architecture couvre bien les besoins du CDC pour :
- totaux par jour / semaine / mois ;
- travail vs pause ;
- secteurs dominants ;
- jours productifs ;
- périodes productives ;
- dispersion ;
- changements de tâche ;
- énergie moyenne.

---

## 6. Petits points à harmoniser encore

## 6.1 Libellés courts vs noms de référence
### Règle proposée
- dans les documents de référence : noms complets
- dans l’UI : libellés courts autorisés

Exemple :
- document : **Suivi hebdomadaire**
- UI : **Suivi hebdo**

---

## 6.2 Distinction “tâche active” vs “chrono actif”
### Règle proposée
- **Tâche active** = nom d’interface
- **chrono actif** = logique métier interne éventuelle

Objectif : éviter les doublons de vocabulaire.

---

## 6.3 Export
### Point à clarifier plus tard
Le CDC et l’architecture mentionnent bien les exports, mais il faudra encore préciser :
- champs exportés ;
- format exact ;
- logique de sauvegarde / restauration ;
- ordre de priorité entre CSV / Excel / texte.

---

## 6.4 Vue d’ensemble
### Point à surveiller
La vue d’ensemble devient riche. Il faudra garder un œil sur :
- le niveau réel de priorité des blocs ;
- la densité ;
- le risque de surcharge visuelle.

Ce n’est pas bloquant, mais cela devra être arbitré lors du prototype.

---

## 7. Décisions de référence à figer

Les décisions suivantes doivent maintenant être considérées comme la base stable du projet :

### Fonctionnel
- V1 locale ;
- stockage local robuste ;
- une seule tâche active à la fois ;
- pause gérée séparément ;
- vues jour / semaine / mois / ensemble.

### UI
- écran principal vertical ;
- Tâche active prioritaire ;
- Démarrage rapide avec **Temps de pause** séparé ;
- suivi hebdomadaire en logique agenda ;
- suivi mensuel en logique colonnes + courbe ;
- vue d’ensemble avec indicateurs + tendances + analyses.

### Technique
- React + TypeScript + Vite ;
- Tailwind ;
- Dexie / IndexedDB ;
- Recharts ;
- architecture sans backend obligatoire pour la V1.

---

## 8. Conclusion

### Bilan
Le projet est désormais assez mûr pour :
- figer le périmètre V1 ;
- préparer le schéma de données définitif ;
- démarrer un prototype fonctionnel.

### Ce qu’il reste à faire avant le code
Les prochaines étapes les plus utiles sont :
1. figer le **périmètre V1 final** ;
2. relire rapidement les priorités des vues ;
3. préparer le **schéma de données définitif** ;
4. démarrer la base du projet technique.

---

## 9. Recommandation

La recommandation la plus logique maintenant est :
**ne plus ajouter trop de nouvelles idées produit avant d’avoir défini le périmètre exact de la V1 et commencé le prototype.**

Le bon prochain document est donc :
**Périmètre V1 final**.

