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

## Itération 6 — 2026-07-16 (à la demande)

**Audit** : le pari de duel (itération 5) était invisible hors de l'onglet Duel ;
l'indicateur « dernier » aidait à voir qui avait fait une tâche, mais rien ne
suggérait quoi faire ; aucun retour sonore, aucun moyen de désactiver un nudge.

**Améliorations livrées :**
- 🔔 **Rappel de l'enjeu sur l'onglet Quêtes** : bandeau doré discret rappelant
  l'enjeu en cours dès l'écran principal, sans avoir à ouvrir Duel.
- 👉 **Suggestion de tâche équitable** : la tâche jamais faite (ou faite il y a le
  plus longtemps) est repérée par un badge « à ton tour ? » et une bordure dorée.
  Désactivable dans Réglages → Apparence (propre à l'appareil).
  N'écrase pas la quête dorée du jour si elles coïncident.
- 🔊 **Sons synthétisés** (Web Audio, pas de fichier externe) sur montée de niveau
  et haut fait débloqué — un petit carillon distinct pour chacun. Interrupteur
  dans Réglages → Apparence, propre à l'appareil, activé par défaut.
- ✅ Tests : 39 assertions — rappel de pari, suggestion (avec gestion du cas de
  collision avec la quête bonus), et persistance des deux interrupteurs après
  rechargement.

## Itération 7 — 2026-07-16 (à la demande)

**Audit** : les réclamations (récompense, pari) manquaient de célébration visuelle ;
l'équité des tâches était suggérée (itération 6) mais jamais mesurée dans la durée.

**Améliorations livrées :**
- 🎉 **Confettis** (canvas, ~1,6 s, aucune image externe) à la réclamation d'une
  récompense ou d'un pari — respecte `prefers-reduced-motion` (aucune animation
  créée si le réglage système est actif).
- ⚖️ **Répartition des tâches** (onglet Duel, nouveau panneau) : pour chaque tâche
  déjà accomplie, le nombre de fois par chacun avec une barre de proportion aux
  couleurs des joueurs, et un badge ⚖️ quand c'est nettement déséquilibré (≥3
  fois faite, et l'un des deux en fait ≥80 % ou 0 %).
- ✅ Tests : 46 assertions — confettis sur les deux points de réclamation,
  absence de confettis en mouvement réduit (contexte Playwright dédié), badge de
  déséquilibre sur une tâche injectée délibérément à sens unique.

## Itération 8 — 2026-07-16 (planifiée)

**Audit** : la piste « notifications de rappel » restait en attente depuis
l'itération 5, faute d'une décision technique claire ; le graphique XP hebdo
(itération 2) n'avait toujours pas d'alternative texte malgré le guide dataviz.

**Décision tranchée** : pas de vraie notification push (nécessiterait un serveur
et des abonnements — hors de portée de cette architecture 100 % statique). À la
place, un rappel honnête, actif uniquement quand l'appli est ouverte.

**Améliorations livrées :**
- 🌙 **Rappel du soir** : bandeau discret sur l'onglet Quêtes si personne n'a
  joué aujourd'hui, à partir d'une heure réglable (20 h par défaut). Bouton
  « Plus tard » qui le masque pour le reste de la journée. Activable/désactivable
  et heure réglable dans Réglages, propre à l'appareil.
- 📊 **Vue tableau accessible** pour le graphique XP par semaine (bascule
  « Voir en tableau »/« Voir en graphique » dans Duel) : même donnée en `<table>`
  sémantique (`scope="row"/"col"`), pour qui préfère lire des nombres ou utilise
  un lecteur d'écran.
- ✅ Tests : 58 assertions — bascule graphique/tableau, et rappel du soir testé
  dans un contexte dédié (affichage, masquage via « Plus tard », persistance du
  masquage le même jour, réapparition le lendemain, désactivation).

## Itération 9 — 2026-07-17 (à la demande)

**Audit** : deux pistes en attente ne nécessitaient pas de nouvelle table
Supabase — priorité sur le mode saison (structurel, migration nécessaire, écarté
cette fois pour rester sur du terrain sûr).

**Améliorations livrées :**
- 📋 **Récap hebdo du dimanche soir** : une fenêtre système s'affiche une fois,
  le dimanche à partir de 18 h, résumant l'XP et les quêtes de chacun cette
  semaine, le leader, et un rappel de l'enjeu en cours s'il y en a un.
  Activable/désactivable dans Réglages (propre à l'appareil).
- 📤 **Carte partageable du mur des trophées** : bouton « Partager » dans Duel
  qui génère une image (canvas, 1080×1350, aux couleurs du thème actif) avec
  niveaux, rangs et trophées des deux chasseurs. Utilise le partage natif du
  téléphone (`navigator.share`) quand disponible, sinon téléchargement direct.
- ✅ Tests : 65 assertions — récap hebdo testé via invocation directe des
  fonctions exposées (indépendant du jour/heure réels de la machine de test,
  pour éviter toute fragilité un vrai dimanche soir), export image testé sur
  les deux chemins (partage natif simulé et repli téléchargement).

## Itération 10 — 2026-07-17 (à la demande, avec précision utilisateur en cours de route)

**Audit** : deux pistes sans changement de schéma (recherche Journal, carte de
duel) ; en cours de route, demande explicite de l'utilisateur — un rappel
quotidien façon Duolingo pour ne pas perdre sa série.

**Décision tranchée sur le rappel de série** : pas de vraie notification push
en arrière-plan (même limite qu'à l'itération 8, aucun serveur). À la place :
le rappel du soir existant devient **conscient des séries en jeu**, complété
par une **vraie notification navigateur en option** (best-effort — fonctionne
sur Android/desktop ; sur iPhone, Safari ne le permet pas hors app installée
avec un service push, donc le rappel dans l'appli reste la garantie sur tous
les appareils).

**Améliorations livrées :**
- 🔥 **Rappel conscient des séries** : le bandeau du soir affiche désormais
  « 🔥 *Nom* va perdre sa série de *N* jours ! » dès qu'une série est en jeu
  (vivante grâce à hier, rien encore aujourd'hui) — remplace le message
  générique quand c'est le cas. Se déclenche même si l'autre joueur a déjà
  joué aujourd'hui, tant qu'un des deux est en risque.
- 🔔 **Notification navigateur** (opt-in, désactivée par défaut) : une vraie
  notification système une fois par jour quand le rappel est actif, via le
  service worker si possible, sinon `Notification()` directement. Réglage
  clairement documenté sur ses limites par plateforme.
- 🔍 **Recherche et filtre dans le Journal** : champ de recherche par nom de
  tâche + filtre par joueur, curseur de saisie préservé pendant la frappe.
- ✅ Tests : 76 assertions — dont deux vrais bugs de test découverts et
  corrigés en cours de route (pas de bug applicatif) : une hypothèse fausse
  sur les données restantes après un `undo`, et un `JSON.parse(null)` dans un
  contexte n'ayant encore jamais écrit dans `localStorage`.

## Itération 11 — 2026-07-17 (à la demande, cadence passée à toutes les 2h)

**Audit** : deux pistes en attente, sans changement de schéma.

**Améliorations livrées :**
- 📤 **Carte partageable du duel de la semaine** — bouton « Partager » à côté
  de « Duel de la semaine » dans Duel, image 1080×1150 aux couleurs du thème
  actif (XP de chacun, barre de proportion, couronne du leader). Réutilise le
  même mécanisme de partage/téléchargement que le mur des trophées.
- 🧹 **Factorisation des cartes canvas** : fond, en-tête « SYSTÈME / RANGEMENT »
  et pied de page extraits en fonctions communes (`cardColors`, `cardCanvas`,
  `cardHeader`, `cardFooter`, `shareCanvasCard`) — évite la duplication entre
  mur des trophées et duel, et simplifie l'ajout d'une prochaine carte.
- 🔔 **Historique des notifications envoyées** — visible dans Réglages sous
  l'interrupteur, une fois les notifications activées : date et contenu des
  14 dernières notifications réellement envoyées (transparence).
- ✅ Tests : 82 assertions.

## Itération 12 — 2026-07-17 (demande utilisateur : système de héros)

**Demande** : incarner des personnages d'anime débloqués au mérite (plus le
personnage est apprécié, plus il est dur à obtenir — difficultés à définir par
la boucle), avec du stuff évolutif. Univers demandés : Frieren, L'Apothicaire,
Gachiakuta, Black Clover, One Piece, Bleach, Demon Slayer, Fullmetal Alchemist.

**Livré :**
- 🎴 **Nouvel onglet Héros** : collection de **26 héros** répartis en 4 raretés
  (B/A/S/SS) sur les 8 univers. Déblocage **au mérite, sans hasard** : niveaux,
  quêtes cumulées, séries, trophées hebdo. Boss final : Luffy 👒 (niv. 28,
  100 quêtes, série 14 j, 2 trophées). Représentation par emblèmes emoji (pas
  d'images copiées des œuvres).
- ⭐ **Stuff évolutif** : 3 paliers d'équipement thématiques par héros (ex.
  Gear 2 → Gear 4 → Gear 5 pour Luffy), débloqués en continuant à progresser
  après l'obtention. Seuils dérivés de la rareté.
- 🧝 **Incarnation synchronisée** : le héros incarné devient l'avatar du joueur
  partout (cartes, boutons de quête, journal) et se synchronise entre les deux
  téléphones (colonne `players.character_id`, seule modif de schéma — la
  collection elle-même est dérivée du journal, aucun stockage).
- ‼ **Notification « HÉROS DÉBLOQUÉ »** prioritaire sur la montée de niveau.
- Barre d'onglets resserrée (6 onglets).
- ✅ Tests : 93 assertions — collection complète, verrouillage sur compte
  frais, déblocage total après grind simulé (300 quêtes/15 jours), incarnation,
  persistance, stuff, retrait, et priorité de la modale de déblocage.
  Une assertion existante a flaké une fois (dismiss du rappel du soir) puis
  repassé — test renforcé avec diagnostic du stockage pour la prochaine fois.

## Itération 13 — 2026-07-17 (soir)

**Audit** : les héros verrouillés n'affichaient que la condition brute (« niv. 13 ·
35 quêtes ») sans dire où on en est — friction motivationnelle ; le nouveau système
de héros n'alimentait pas les hauts faits ; l'historique de notifications ne
pouvait pas être vidé (piste notée à l'it. 11).

**Améliorations livrées :**
- 📈 **Progression visible sur chaque héros verrouillé** : « niv. 8/13 ·
  20/35 quêtes », les critères déjà remplis passent en couleur de rareté avec ✓.
  On sait toujours ce qui manque pour le prochain déblocage.
- 🎴 **4 hauts faits héros** : Premier héros débloqué, 5 héros, Moitié du
  panthéon (seuil dynamique sur la taille du roster), Âme liée (incarner un
  héros). Toujours dérivés de l'état — zéro stockage, zéro migration.
- 🧹 **Bouton « Effacer l'historique »** des notifications dans Réglages
  (l'anti-doublon quotidien est conservé).
- ✅ Tests : 98 assertions (+5) — format de progression sur Luffy, hauts faits
  héros verrouillés/débloqués/Âme liée, vidage de l'historique.

## Itération 14 — 2026-07-17 (nuit)

**Audit** : les tâches ne pouvaient être que créées/supprimées — impossible de
corriger une faute de frappe ou changer une icône sans tout refaire
(personnalisation incomplète) ; l'onglet Héros listait la collection sans
désigner d'objectif immédiat (piste « presque débloqués » de l'it. 13).

**Améliorations livrées :**
- 🎯 **« Prochaine recrue »** : l'onglet Héros met en avant le héros verrouillé
  le plus proche du déblocage (moyenne des ratios critère par critère), avec
  sa progression détaillée — un objectif clair à chaque visite. Disparaît
  quand la collection est complète.
- ✏️ **Tâches éditables en place** : nom et icône modifiables directement dans
  Réglages (en plus de la priorité), synchronisés entre téléphones via le même
  upsert que le reste. Valeur vide → restauration de l'ancienne.
- ✅ Tests : 103 assertions (+5) — renommage/icône propagés à l'onglet Quêtes,
  Prochaine recrue = Sein sur compte frais, panneau absent quand tout est
  débloqué.

**Pistes pour les prochaines itérations** (à réévaluer à chaque audit) :
- Ambiguïté à clarifier avec l'utilisateur : « gachiacuta dans macchi » —
  Dandadan ? (à ajouter dès confirmation, la structure roster le permet en
  quelques lignes).
- Mode saison : remise à zéro rituelle avec palmarès archivé (table `seasons`
  à proposer clairement avant d'y toucher).
- Choix de l'heure du rappel de série indépendamment du rappel générique du soir.
- Revoir la taille du fichier index.html (grossit à chaque itération).
