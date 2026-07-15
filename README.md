# ⚔️ Rangement — Système de Chasse

Application de ménage gamifiée pour deux, inspirée de **Solo Leveling** : chaque tâche
ménagère est une quête qui rapporte de l'XP selon sa priorité, vous montez de niveau
et de rang (E → D → C → B → A → S → Monarque), et vous vous affrontez en duel
hebdomadaire pendant que vos objectifs communs débloquent de vraies récompenses
(ciné, Uber Eats, Calicéo…).

## 🚀 Lancer l'application

Aucune installation : ouvrez simplement **`index.html`** dans un navigateur
(téléphone ou ordinateur).

Pour y accéder à deux depuis vos téléphones, le plus simple est d'activer
**GitHub Pages** sur ce dépôt (Settings → Pages → branche `main`, dossier `/`) :
l'appli sera disponible à une URL du type `https://<pseudo>.github.io/Rangement/`.

> ℹ️ Les données sont enregistrées dans le navigateur (localStorage), donc chaque
> appareil a sa propre sauvegarde. Utilisez un téléphone « officiel » commun pour
> le score, ou l'export/import JSON dans **Réglages** pour transférer les données.

## 🎮 Comment ça marche

### Quêtes & XP
- Chaque tâche a une priorité qui fixe son XP : **Basse 10 · Normale 20 · Haute 35 · Critique 50**.
- Quand une tâche est faite, touchez l'emoji du chasseur qui l'a accomplie.
- **Quête dorée** : chaque jour, une tâche tirée au sort rapporte le **double** d'XP.
- **Bonus de série 🔥** : +5 % d'XP par jour d'activité consécutif (max +50 %). Ne cassez pas la chaîne !

### Niveaux & rangs
Passer un niveau coûte de plus en plus d'XP. Les rangs de chasseur :

| Rang | Niveau |
|------|--------|
| E | 1–4 |
| D | 5–9 |
| C | 10–14 |
| B | 15–19 |
| A | 20–29 |
| S | 30–49 |
| 👑 Monarque | 50+ |

### Duel
L'onglet **Duel** compare vos XP de la semaine, du mois et de toujours.
Celui ou celle qui mène la semaine porte la couronne 👑 sur sa carte.

### Objectifs & récompenses
- Créez un **défi commun** (ex : « 300 XP à deux cette semaine ») et associez-lui
  une récompense de votre liste (ciné 🎬, Uber Eats 🍔, Calicéo 💆, ou vos idées).
- Chaque quête accomplie par l'un de vous deux fait avancer le défi.
- Objectif atteint → une fenêtre système s'affiche et la récompense passe dans
  **Récompenses gagnées** : à vous de la savourer !

### Journal & réglages
- Le **Journal** garde l'historique complet, avec un bouton *Annuler* en cas d'erreur.
- Dans **Réglages** : renommez les chasseurs, gérez les tâches et leurs priorités,
  exportez/importez une sauvegarde, ou réinitialisez tout.

Bonne chasse, et que l'appartement tremble. ⚔️🏹
