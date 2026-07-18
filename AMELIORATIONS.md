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

## Itération 15 — 2026-07-18 (demande utilisateur : « nouvelle itération »)

**Audit** : la modale « HÉROS DÉBLOQUÉ » célébrait puis renvoyait vers l'onglet
Héros pour incarner (friction au moment le plus fort émotionnellement) ; le
héros incarné n'avait pas de carte partageable alors que trophées et duel en
ont une.

**Améliorations livrées :**
- ⚡ **Incarner en un geste** : la modale de déblocage propose directement
  « Incarner 🎴 » (en plus de Continuer). `sysModal` accepte désormais un
  bouton d'action optionnel ; la logique d'incarnation est factorisée
  (`equipChar`) avec le bouton de la collection.
- 📤 **Carte de héros partageable** (canvas 1080×1350, comme trophées/duel) :
  emblème, nom, rareté (couleur du cadre), univers, paliers de stuff, « incarné
  par X — rang · niveau ». Bouton « 📤 Partager » sur le panneau Héros incarné ;
  partage natif ou téléchargement PNG.
- ✅ Tests : 108 assertions (+5) — bouton Incarner dans la modale, incarnation
  effective en un geste, téléchargement de la carte de héros. Un flake de
  contention CPU (tests lancés en parallèle des captures d'écran) a fait
  échouer le scénario de déblocage une fois : reproduction isolée 3/3 OK,
  assertion diagnostique ajoutée (« état injecté conservé après
  rechargement »), et règle retenue — ne plus rien exécuter en parallèle de
  la suite.

## Itération 16 — 2026-07-18 (matin)

**Audit** : les 4 thèmes ne variaient que les accents — fond sombre imposé,
pénible en plein soleil et pas au goût de tout le monde (personnalisation
incomplète). Import/export déjà en place, rien à faire là.

**Améliorations livrées :**
- 🌅 **Thème clair « Aube »** (5ᵉ thème) : palette complète — fond, panneaux,
  encres, champs, doré/vert/rouge/orange assombris pour rester lisibles sur
  blanc, barre d'onglets claire, dégradé du titre adapté, `color-scheme`
  (contrôles natifs clairs) et meta `theme-color` dynamique (barre du
  navigateur assortie). Toujours propre à chaque téléphone.
- 🧹 Préalable technique : toutes les couleurs codées en dur variabilisées
  (`--field` pour les champs/jauges, `--navbg`, `--logo-top`), et les cartes
  canvas partagées lisent désormais `--gold`/`--abyss` — elles suivent donc
  aussi le thème clair.
- ✅ Tests : 112 assertions (+4) — fond clair appliqué, meta theme-color,
  persistance après rechargement, retour propre au sombre. Validation
  visuelle sur Quêtes/Duel/Réglages.

## Itération 17 — 2026-07-18 (midi)

**Audit** : créer un défi commun partait d'une page blanche (nom + type +
cible + récompense à inventer), et rien n'aidait à choisir une cible réaliste.

**Améliorations livrées :**
- ⚡ **Presets de défi en un tap** : « Sprint 300 XP », « 20 quêtes »,
  « Grand ménage 1 000 XP » préremplissent le formulaire (nom, type, cible) —
  il ne reste qu'à choisir la récompense et lancer.
- 📈 **Rythme du duo affiché** : « Votre rythme actuel : ~N XP par semaine à
  deux » (moyenne des 28 derniers jours) sous le formulaire, pour calibrer la
  cible sans deviner.
- ✅ Tests : 115 assertions (+3) — rythme affiché, préremplissage du preset,
  défi préréglé effectivement lancé.

## Itération 18 — 2026-07-18 (nuit)

**Audit** : la piste « heure du rappel de série indépendante » attendait depuis
l'it. 11 ; l'activité quotidienne n'était visible nulle part dans la durée
(le graphique hebdo agrège par semaine — aucune vue jour par jour, alors que
les séries se jouent au jour près) ; le bonus de série (+5 %/jour) restait
invisible, on ne voyait que « 🔥 N j » sans l'effet concret.

**Améliorations livrées :**
- 🕐 **Heure du rappel de série 🔥 indépendante** : nouveau champ dans Réglages —
  quand une série est en jeu, le rappel peut sonner plus tôt que le rappel
  générique du soir (par défaut il suit la même heure ; vider le champ le
  réaligne). Propre à l'appareil, comme le reste du rappel.
- 🗓️ **Calendrier d'activité** (onglet Duel) : heatmap des 8 dernières semaines
  façon Duolingo/GitHub — une case par jour, ramp séquentiel doré construit en
  `color-mix` sur les variables du thème (suit automatiquement les 5 thèmes,
  vérifié en Aube), case du jour cerclée, jours futurs en pointillés, légende
  moins→plus, détail par joueur en infobulle. Dérivé du journal, zéro stockage.
- 🔥 **Multiplicateur de série visible** : la carte du chasseur affiche
  « 🔥 7 j · +35 % » au lieu de « 🔥 7 j » — le bénéfice concret de la série.
- 🛠️ Note d'infra : la boucle tourne désormais aussi hors sandbox — repli des
  tests sur le Chrome système (`/opt/google/chrome/chrome`) quand le chromium
  Playwright n'est pas installé (`tests/helpers.js`).
- ✅ Tests : 122 assertions (+7) — calendrier (56 cases, case du jour active),
  multiplicateur sur la carte, heure de série stockée séparément, rappel de
  série visible avant l'heure générique, aucun rappel avant les deux heures.

## Itération 19 — 2026-07-18 (matin, réponses utilisateur)

**Ambiguïté résolue** : « gachiacuta dans macchi » voulait dire **DanMachi**
(pas Dandadan). Demandes précises : ajouter des personnages de DanMachi, et
**Yamato (One Piece) dans une rareté « GOD » au-dessus de SS**.

**Améliorations livrées :**
- 🏛️ **9ᵉ univers : DanMachi** — Hestia 🎀 (B, niv. 5), Bell Cranel 🐇
  (A, niv. 9 · 22 quêtes), Aiz Wallenstein ⚜️ (S, niv. 16 · série 6 j),
  chacun avec ses 3 paliers de stuff (Couteau du Minotaure → Argonaute, etc.).
- 🐺 **Rareté GOD** (badge rouge #FF5C6E) : nouveau sommet de la collection —
  **Yamato**, boss final au-dessus de Luffy : niv. 30 · 120 quêtes · série
  15 j · 2 trophées. Stuff : Kanabō d'Oden → Fruit du Loup divin → Okuchi no
  Makami. Paliers GEAR_STEPS dédiés à la rareté GOD.
- La collection passe de 26 à **30 héros** ; tous les seuils dynamiques
  (haut fait « Moitié du panthéon », compte de collection) suivent seuls.
- ✅ Tests : 125 assertions (+3) — Yamato GOD boss final, badge GOD, présence
  des 3 DanMachi ; le grind du scénario de déblocage passe à 310 quêtes pour
  atteindre le niveau 30 (courbe : 15 080 XP cumulés).

## Itération 20 — 2026-07-18 (routine cloud, 10h11)

**Audit** : l'appli est une PWA complète (manifest + service worker) mais ne
propose jamais de l'installer — aucune capture de `beforeinstallprompt`, ni
d'instructions iOS ; le réglage de notification navigateur (it. 10) ne peut
être vérifié qu'en attendant le soir, sans retour immédiat ; les récompenses
(onglet Objectifs) ne pouvaient être qu'ajoutées/supprimées, alors que les
tâches sont éditables en place depuis l'itération 14 — incohérence de
personnalisation entre les deux listes.

**Améliorations livrées :**
- 📲 **Bouton d'installation de l'application** (Réglages) : capture
  `beforeinstallprompt` et propose « Installer sur cet appareil » en un tap
  quand le navigateur le permet (Android/desktop) ; sur iPhone/iPad, affiche
  les étapes Safari (Partager → Sur l'écran d'accueil) faute d'API ; masqué
  dès que l'app tourne déjà en mode standalone.
- 🧪 **Bouton « Tester la notification »** : visible dès que la notification
  navigateur est activée, envoie un appel immédiat (indépendant de l'anti-
  doublon quotidien et de l'heure du rappel) pour confirmer tout de suite que
  le navigateur autorise bien l'envoi, avec trace dans l'historique.
- ✏️ **Récompenses éditables en place** : nom et icône modifiables
  directement dans « Idées de récompenses » (Objectifs), même mécanique que
  les tâches (valeur vide → restauration de l'ancienne), synchronisé entre
  téléphones.
- ✅ Tests : 136 assertions (+11) — panneau d'installation affiché/masqué
  (standalone simulé via `matchMedia`), invite native captée et déclenchée
  (`beforeinstallprompt` simulé), bouton de test de notification (appel
  immédiat + historique), édition de récompense (nom, icône, restauration
  sur champ vidé). Un flake de contention CPU a fait échouer une assertion
  du rappel du soir lors d'un premier passage où des boucles de surveillance
  tournaient en tâche de fond en parallèle du test (violation de la règle
  « rien en parallèle ») ; reproduction isolée immédiate 1/1 OK, aucune
  correction applicative nécessaire — leçon retenue : ne plus lancer de
  moniteur/poll de fond pendant l'exécution des suites.
## Itération 21 — 2026-07-18 (session interactive, en parallèle de l'it. 20)

**Audit** : aucun retour immédiat sur « ce qu'on a fait aujourd'hui » depuis
l'onglet principal (le calendrier et le duel sont dans un autre onglet) ; la
collection de 30 héros sur 9 univers impose un long scroll sans filtre ; une
PWA installée ne signalait jamais qu'une nouvelle version était prête (le
service worker network-first se met à jour silencieusement au prochain
démarrage seulement).

**Améliorations livrées :**
- ☀️ **Bandeau « Aujourd'hui »** en tête de l'onglet Quêtes : « 3 quêtes ·
  75 XP à deux (⚔️ 2 · 🏹 1) » — dérivé du journal, absent si rien n'a été
  fait (le rappel du soir prend alors le relais).
- 🎴 **Filtre de la collection par univers** (chips « Tous / Frieren / … »)
  + compteur de déblocage par univers dans chaque en-tête (« One Piece 0/6 »).
  Filtre de session, comme le sélecteur de joueur.
- ⬆️ **Bannière de mise à jour PWA** : quand le service worker détecte une
  nouvelle version installée en attente, un toast « Nouvelle version de
  l'appli disponible — Recharger » (30 s) permet de basculer immédiatement.
  `toast()` accepte désormais une durée optionnelle.
- ✅ Tests : +6 assertions — bandeau du jour et répartition par joueur,
  bannière de mise à jour (invocation directe, pas de SW en file://), filtre
  One Piece (6 héros, un seul univers), compteur 0/6, retour « Tous ».
  Total après fusion avec l'it. 20 de la routine : 142 assertions.
  Leçon d'orchestration : la routine 2 h et la session interactive ont
  travaillé en même temps (départ décalé de la routine à 10h11) — toujours
  re-puller avant de pousser, et les numéros d'itération se résolvent au
  rebase.

## Itération 22 — 2026-07-18 (routine cloud)

**Audit** : un audit ciblé (agent dédié, lecture complète d'index.html face à
l'historique des 21 itérations) a fait remonter la piste « bouclier de série »
en attente depuis l'itération 11, plus deux frictions concrètes non couvertes :
un mistap sur le mauvais chasseur devenait irrattrapable dès qu'une modale
spéciale (NIVEAU/HAUT FAIT/OBJECTIF ATTEINT) s'affichait avant le toast
« Annuler » ; et le panneau « Prochaine recrue » de l'onglet Héros ignorait le
filtre d'univers actif, recommandant parfois un héros hors du filtre choisi.

**Améliorations livrées :**
- 🛡️ **Bouclier de série façon Duolingo** : un bouclier est gagné
  automatiquement tous les 7 jours de série *naturelle* (hors jours déjà
  protégés) ; s'il en reste un disponible et qu'une seule journée est
  manquée, elle est comblée tout seul au chargement suivant (entrée de
  journal `{ xp: 0, note: "bouclier" }`, id déterministe pour rester
  idempotent entre les deux téléphones) — la série continue sans interruption.
  N'alimente ni les hauts faits, ni le compteur « Quêtes accomplies », ni les
  conditions de déblocage des héros (seule `streakOf` en tient compte).
  Compte de boucliers disponibles affiché dans les statistiques du Duel, avec
  rappel du fonctionnement. Zéro nouvelle colonne — dérivé du journal.
- ⚡ **Annuler depuis n'importe quelle modale spéciale** : les fenêtres
  NIVEAU, OBJECTIF ATTEINT et HAUT FAIT proposent désormais un bouton
  « Annuler » (même mécanisme que le toast et que le bouton « Incarner » de
  la modale HÉROS DÉBLOQUÉ) — un mistap n'oblige plus à aller chercher
  l'entrée dans le Journal.
- 🎯 **« Prochaine recrue » cohérente avec le filtre d'univers** : filtrer la
  collection sur un univers (ex. One Piece) recalcule aussi la recrue
  suggérée dans cet univers, au lieu d'afficher un héros d'un autre univers.
- ✅ Tests : +12 assertions (152 au total : 145 dans smoke.js, 7 dans
  sync-test.js) — cycle complet du bouclier (gagné après 7 jours naturels,
  comblement automatique, série prolongée, consommation, exclusion du
  décompte de quêtes, absence de déclenchement avec seulement 3 jours),
  bouton Annuler depuis une modale de montée de niveau, cohérence de
  « Prochaine recrue » avec le filtre d'univers. Validation visuelle
  (captures 390×844) sur Quêtes, Duel et Héros filtré.

**Pistes pour les prochaines itérations** (à réévaluer à chaque audit) :
- Mode saison : schéma `seasons` proposé à l'utilisateur (validation en
  attente — rien ne sera créé en base sans accord explicite).
- Revoir la taille du fichier index.html (grossit à chaque itération).

## Itération 23 — 2026-07-18 (routine cloud)

**Audit** : trois pistes en attente depuis l'itération 22, aucune ne
nécessitant de changement de schéma — les trois ont été traitées.

**Améliorations livrées :**
- 📝 **Note libre sur une entrée du Journal** : bouton crayon ✏️ sur chaque
  entrée (sauf les entrées « bouclier », techniques) ouvrant un champ
  d'édition en place ; la note remplace l'éventuel tag auto (« ×2 »,
  « 🔥+35% ») pour devenir un commentaire perso, synchronisée entre
  téléphones via le même upsert que le reste (`log.note` existait déjà,
  aucune migration). Correction de layout au passage : la ligne du journal
  passe en `flex-wrap` et le nom de tâche tronque proprement (`ellipsis`)
  pour que le bouton « Annuler » ne soit plus jamais poussé hors écran par
  une note ou un nom de tâche longs — bug découvert pendant la validation
  visuelle de cette même fonctionnalité, corrigé avant commit.
- 🔥 **Série de victoires hebdomadaires** dans les statistiques du Duel
  (« Série de victoires 🔥 ») : semaines écoulées consécutives (les plus
  récentes d'abord) remportées par le même chasseur, dérivée de
  `trophyData()`, stoppée à la première égalité ou défaite.
- ✏️ **Réglages → Chasseurs aligné sur le pattern `onchange`** : nom, emoji
  et couleur s'enregistrent séparément dès le changement de chaque champ
  (comme les tâches et récompenses), suppression du bouton « Enregistrer »
  devenu incohérent avec le reste de l'écran.
- ✅ Tests : 159 assertions (+5 dans smoke.js : édition de note, persistance
  après rechargement, valeur de la série de victoires calculée sur une
  semaine passée injectée). Suite `sync-test.js` inchangée (7 assertions),
  repassée intégralement après le correctif de layout. Validation visuelle
  (captures 390×844) sur Journal (avant/pendant/après édition de note),
  Duel (nouvelle ligne de stats) et Réglages (Chasseurs sans bouton).

**Pistes pour les prochaines itérations** (à réévaluer à chaque audit) :
- Mode saison : schéma `seasons` proposé à l'utilisateur (validation en
  attente — rien ne sera créé en base sans accord explicite).
- Revoir la taille du fichier index.html (grossit à chaque itération).

## Itération 24 — 2026-07-18 (routine cloud)

**Audit** : un audit ciblé (agent dédié, lecture complète d'index.html face à
l'historique des 23 itérations) a fait remonter trois frictions concrètes,
aucune ne nécessitant de changement de schéma : les suppressions de tâches,
récompenses et défis étaient instantanées et sans filet (contrairement au
Journal et aux quêtes accomplies, annulables depuis un toast) ; une seule
modale système s'affichait quand plusieurs jalons tombaient sur la même
quête (ex. niveau + objectif atteint), les suivants étant perdus en
silence ; la recherche du Journal ignorait les notes libres ajoutées à
l'itération 23 ; et le meilleur score de série (`bestStreakOf`, déjà
calculé pour les hauts faits) n'était jamais montré à côté de la série en
cours.

**Améliorations livrées :**
- ↩️ **Suppressions avec filet de rattrapage** : supprimer une tâche, une
  récompense ou abandonner un défi affiche désormais un toast « Annuler »
  (5 s), comme pour une quête accomplie — un mistap ne demande plus de
  tout retaper. Une seule fonction (`deleteWithUndo`) factorise les trois
  cas, ré-insère l'élément à sa position d'origine et repropage l'upsert
  vers Supabase en cas d'annulation.
- 🔗 **Enchaînement des jalons simultanés** : quand une quête déclenche
  plusieurs événements à la fois (montée de niveau, objectif atteint, haut
  fait, héros débloqué), toutes les modales s'affichent désormais à la
  suite (« Continuer » passe à la suivante) au lieu qu'une seule priorité
  masque les autres. « Annuler » sur n'importe quel jalon interrompt toute
  la chaîne et annule la quête, comme avant.
- 🏆 **Record de meilleure série** affiché dans les statistiques du Duel
  (« Meilleure série 🏆 »), à côté de la série en cours — dérivé de
  `bestStreakOf`, déjà calculé pour les hauts faits, zéro nouvelle donnée.
- 🔍 **Recherche du Journal étendue aux notes libres** : chercher un mot
  d'une note perso (ex. « bien joué ») retrouve désormais l'entrée
  correspondante, pas seulement par nom de tâche.
- ✅ Tests : 182 assertions au total (175 dans smoke.js +23, 7 dans
  sync-test.js inchangée) — suppression avec annulation pour les tâches,
  récompenses et défis (dont la disparition immédiate de l'onglet Quêtes) ;
  enchaînement complet des trois modales sur un scénario à trois jalons
  simultanés construit précisément (niveau + objectif + haut fait), avec
  vérification qu'« Annuler » sur le premier jalon interrompt bien toute la
  chaîne (aucune modale suivante, quête bien annulée) ; recherche du
  Journal par note ; ligne « Meilleure série » dans les stats du Duel.
  Deux faux échecs (montée de niveau attendue vs haut fait affiché, et
  tout le bloc bouclier de série) sont apparus lors d'un premier passage où
  deux boucles de surveillance (Monitor) tournaient en tâche de fond en
  parallèle du test — reproduction isolée immédiate, tout repasse au vert
  sans aucune correction applicative ; leçon reconfirmée (déjà notée aux
  itérations 15/20/22) : ne jamais laisser de moniteur actif pendant une
  suite de tests, y compris un simple `pgrep` en boucle. Validation visuelle
  (captures 390×844) : suppression de tâche et abandon de défi avec toast
  Annuler, les trois modales de la chaîne l'une après l'autre, ligne
  Meilleure série dans Duel, recherche Journal par note.

**Pistes pour les prochaines itérations** (à réévaluer à chaque audit) :
- Mode saison : schéma `seasons` proposé à l'utilisateur (validation en
  attente — rien ne sera créé en base sans accord explicite).
- Revoir la taille du fichier index.html (grossit à chaque itération,
  maintenant ~2 800 lignes).

## Itération 25 — 2026-07-18 (routine cloud)

**Audit** : un audit ciblé (agent dédié, lecture complète d'index.html face à
l'historique des 24 itérations) a fait remonter trois frictions concrètes,
aucune ne nécessitant de changement de schéma : les modales système
(`sysModal`, onboarding) ne posaient jamais le focus clavier à l'ouverture,
ne le piégeaient pas (Tab pouvait sortir vers la barre d'onglets derrière) et
n'avaient pas de raccourci Échap ; les défis de l'onglet Objectifs restaient
la seule liste éditable (nom, cible) alors que tâches (it. 14) et
récompenses (it. 20) le sont déjà en place ; le thème par défaut au premier
lancement ignorait la préférence système clair/sombre de l'appareil malgré
l'existence du thème clair « Aube » depuis l'itération 16.

**Améliorations livrées :**
- ⌨️ **Accessibilité clavier des modales système** : nouvelle fonction
  `trapModal()` (appelée par `sysModal` et l'onboarding) qui pose le focus
  sur le premier bouton à l'ouverture, piège Tab/Shift+Tab dans `.sysbox`
  (boucle entre les boutons sans pouvoir sortir vers l'app derrière), et
  mappe Échap sur l'action « Continuer » — jamais sur « Annuler », pour
  qu'Échap ne puisse jamais annuler une quête par accident.
- ✏️ **Défis éditables en place** : nom et cible modifiables directement sur
  chaque défi actif de l'onglet Objectifs (`data-oname`/`data-otarget`),
  même mécanique `onchange` + upsert que tâches et récompenses (valeur vide
  → restauration de l'ancienne). Colonnes `name`/`target` déjà existantes en
  base, aucune migration.
- 🌗 **Thème par défaut selon la préférence système** : au tout premier
  lancement (avant tout choix explicite), `curTheme()` retient désormais
  « Aube » (clair) si l'appareil est en mode clair, « Système » (sombre)
  sinon — au lieu d'imposer systématiquement le sombre. Le premier choix
  explicite de l'utilisateur dans Réglages écrase ensuite ce défaut comme
  avant.
- ✅ Tests : 192 assertions au total (185 dans smoke.js +10, 7 dans
  sync-test.js inchangée) — focus initial + piège du Tab + retour Shift+Tab
  sur la modale de montée de niveau (2 boutons), Échap ferme la modale du
  haut fait de la première quête, défi édité en place (nom + cible,
  restauration sur nom vide), thème Aube choisi automatiquement sur un
  contexte Playwright en `colorScheme: "light"` sans réglage préalable, et
  thème Système conservé sur `colorScheme: "dark"`. Deux tests existants de
  l'itération 17 (`:has-text("Sprint de la semaine")`) ont été adaptés au
  nouveau rendu en `<input>` (valeur plutôt que texte), sans changement de
  comportement pour l'utilisateur. Validation visuelle (captures 390×844) :
  thème Aube sur compte frais en mode clair, défi éditable dans Objectifs,
  modale « HÉROS DÉBLOQUÉ » avec focus/boutons visibles.
