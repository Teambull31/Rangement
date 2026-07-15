# ⚔️ Rangement — Système de Chasse

Application de ménage gamifiée pour deux, inspirée de **Solo Leveling** : chaque tâche
ménagère est une quête qui rapporte de l'XP selon sa priorité, vous montez de niveau
et de rang (E → D → C → B → A → S → Monarque), et vous vous affrontez en duel
hebdomadaire pendant que vos objectifs communs débloquent de vraies récompenses
(ciné, Uber Eats, Calicéo…).

## 🚀 Application en ligne

**➡️ https://project-75qv6.vercel.app**

L'appli est une **PWA** : installez-la sur l'écran d'accueil comme une vraie application.

- **Android (Chrome)** : ouvrez l'URL → menu ⋮ → **« Ajouter à l'écran d'accueil »**
  (ou « Installer l'application »).
- **iPhone (Safari)** : ouvrez l'URL → bouton **Partager** (carré avec flèche) →
  **« Sur l'écran d'accueil »**.

Elle s'ouvre ensuite en plein écran avec sa propre icône, et fonctionne même hors ligne.

### Déploiement (Vercel)

Le projet Vercel récupère les fichiers depuis ce dépôt GitHub au moment du build
(`build.sh`). Après un push, relancez un déploiement (bouton *Redeploy* dans le
tableau de bord Vercel, ou demandez à Claude de redéployer).

En local, il suffit d'ouvrir **`index.html`** dans un navigateur.

### Synchronisation entre les deux téléphones ☁️

Les scores, quêtes, objectifs et récompenses sont **synchronisés en temps réel**
via une base Supabase (projet `rangement`, région Paris, offre gratuite) :
chacun valide ses quêtes sur son propre téléphone et voit instantanément le
score de l'autre.

- **Hors ligne** : l'appli reste utilisable ; les actions sont mises en file
  d'attente et envoyées automatiquement à la reconnexion (badge d'état dans
  l'en-tête).
- Si la bibliothèque de synchro ne charge pas, l'appli bascule en mode local
  (données du navigateur uniquement).
- L'export JSON dans **Réglages** reste disponible comme sauvegarde de secours.

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
