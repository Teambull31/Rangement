# Journal des améliorations

Boucle d'audit/amélioration continue (une itération toutes les ~6 h).
Chaque entrée liste ce qui a été audité et modifié, pour ne pas refaire deux fois la même chose.

## Itération 1 — 2026-07-15

**Audit** : personnalisation quasi absente (couleurs figées), annulation d'une erreur
de saisie trop loin (Journal), tests hors du dépôt, pas de CI.

**Améliorations livrées :**
- 🎨 **Couleur personnalisable par chasseur** (Réglages) : appliquée à la carte,
  aux boutons de validation des quêtes et à la barre de duel ; synchronisée entre
  téléphones (colonne `players.color` en base).
- ⚡ **Annulation en un geste** : le toast « +XP » affiche un bouton *Annuler*
  pendant 5 s — plus besoin d'aller dans le Journal.
- 📳 **Retour haptique** léger à la validation d'une quête (Android).
- ✅ **Tests dans le dépôt** (`tests/`) avec assertions : parcours complet en mode
  local + couche de synchro face à un faux backend Supabase.
- 🤖 **CI GitHub Actions** : les deux suites tournent à chaque push.

## Itération 2 — 2026-07-15 (18h)

**Audit** : pas de célébration des jalons (rétention), onglet Duel purement numérique,
boutons Annuler du journal < 44 px, toasts invisibles pour les lecteurs d'écran.

**Améliorations livrées :**
- 🏅 **Hauts faits** : 15 badges par chasseur (quêtes cumulées, séries, rangs,
  1 000 XP, grosses quêtes, lève-tôt/oiseau de nuit), grille dans l'onglet Duel
  (débloqués en surbrillance, verrouillés grisés), fenêtre système « HAUT FAIT »
  au déblocage. Calculés depuis le journal — aucun changement de schéma.
- 📊 **Graphique XP par semaine** (8 dernières semaines) dans Duel : barres
  groupées aux couleurs des joueurs, légende, grille discrète, libellés de
  semaines, infobulles. Palette par défaut validée (CVD ΔE 14,1 ; contraste OK).
- ♿ **Accessibilité** : boutons Annuler du journal agrandis (44 px), zone de
  toasts en `aria-live="polite"`, graphique avec `role="img"` + libellé.
- ✅ Tests enrichis : haut fait à la première quête, graphique (16 barres),
  grilles de badges, annulation depuis le toast robuste aux hauts faits horaires.

## Itération 3 — 2026-07-16 (00h)

**Audit** : la compétition n'avait aucune mémoire (le duel repartait de zéro chaque
semaine), les récompenses étaient prévisibles, chips de priorité peu contrastées.

**Améliorations livrées :**
- 👑 **Mur des trophées** (onglet Duel) : vainqueur de chaque semaine écoulée avec
  le score XP, 12 dernières semaines, + ligne « Trophées » dans les statistiques.
  Calculé depuis le journal, la semaine en cours reste en jeu.
- 🎲 **Récompense surprise** : nouvelle option au lancement d'un défi — la
  récompense est tirée au sort parmi la liste au moment de la réclamer
  (« Le sort a désigné : … »).
- 🎨 **Chips de priorité** : fond teinté (color-mix), taille légèrement augmentée.
- ✅ Tests : 29 assertions (récompense surprise de bout en bout, mur des trophées
  avec injection d'une semaine passée, compteur de trophées).

## Itération 4 — 2026-07-16 (06h)

**Audit** : aucun accompagnement au premier lancement (noms par défaut conservés,
mécaniques à deviner), un seul thème visuel.

**Améliorations livrées :**
- 🌅 **Onboarding « Réveil du Système »** : 3 écrans façon Solo Leveling au premier
  lancement — concept (quêtes/XP/rangs), configuration des deux profils (noms,
  emojis, couleurs — l'onboarding fait office de setup), règles du duel et des
  objectifs. Passable, affiché une seule fois par appareil.
- 🎨 **4 thèmes visuels** (Réglages → Apparence) : Système (bleu), Monarque
  (violet), Braise (orange), Guilde (émeraude). Préférence par appareil
  (localStorage), appliquée via les variables CSS.
- ✅ Tests : 34 assertions (parcours d'onboarding complet, application et
  persistance du thème) ; le test de synchro saute l'onboarding via initScript.

## Itération 5 — 2026-07-16 (12h, finalisée à 18h après panne d'infra)

**Audit** : la compétition et les récompenses vivaient côte à côte sans se toucher ;
aucun moyen de voir qui avait fait une corvée en dernier.

**Améliorations livrées :**
- ⚔️ **Pari de duel** (onglet Duel) : miser une récompense (ou la surprise 🎲) sur
  la semaine en cours — bandeau doré « Enjeu de la semaine », synchronisé (table
  `bets`). À la semaine suivante, le vainqueur réclame l'enjeu (« PARI REMPORTÉ »),
  qui rejoint les récompenses gagnées ; en cas d'égalité l'enjeu est retiré.
- 👀 **Indicateur d'équité** : chaque quête affiche « dernier : ⚔️/🏹 » (qui l'a
  faite en dernier), calculé depuis le journal.
- ✅ Tests : 40 assertions — cycle complet du pari (mise → résolution → réclamation
  → récompense créditée) et indicateur « dernier ».

**Pistes pour les prochaines itérations** (à réévaluer à chaque audit) :
- Notifications de rappel (nécessite une décision : push web ou rappels locaux).
- Répartition des tâches : suggérer une tâche « équitable » selon l'historique.
- Mode saison : remise à zéro rituelle avec palmarès archivé.
- Sons/effets optionnels sur montée de niveau (avec réglage on/off).
- Widget récapitulatif hebdo le dimanche soir (dans l'appli).
- Rappel visuel de l'enjeu de pari sur l'onglet Quêtes (bandeau discret).
