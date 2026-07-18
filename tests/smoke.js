/* Test de fumée : parcours complet de l'appli en mode local (sans Supabase). */
const { APP_URL, launch, check, done, closeModals } = require("./helpers");

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(APP_URL);
  await page.waitForSelector(".quest");

  // Onboarding « Réveil du Système » au premier lancement
  await page.waitForSelector("#obNext");
  check("onboarding affiché au premier lancement", true);
  await page.locator("#obNext").click(); // étape 2 : profils
  await page.fill('[data-ob-name="p1"]', "Testeur");
  await page.locator("#obNext").click(); // étape 3
  await page.locator("#obNext").click(); // Commencer la chasse
  check("onboarding fermé", (await page.locator("#obNext").count()) === 0);
  check("nom appliqué depuis l'onboarding", (await page.locator(".hunter .name").first().textContent()).trim() === "Testeur");

  const nQuests = await page.locator(".quest").count();
  check("13 quêtes par défaut", nQuests === 13);

  // Première quête : haut fait « Première quête » + XP créditée
  await page.locator(".quest").first().locator('[data-p="p1"]').click();
  await page.waitForTimeout(300);
  const featModal = (await page.locator(".sysbox").count()) ? (await page.locator(".sysbox").textContent()) : "";
  check("haut fait débloqué à la première quête", featModal.includes("HAUT FAIT"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check("Échap ferme la modale système (équivalent à Continuer)", (await page.locator(".sysbox").count()) === 0);
  await closeModals(page);
  const xpText = (await page.locator(".hunter").first().locator(".xpnums").first().textContent()).trim();
  check("XP créditée après une quête (" + xpText + ")", /^[1-9]\d*\/100 XP/.test(xpText));
  const streakTxt = (await page.locator(".hunter").first().locator(".streak").textContent()).trim();
  check("multiplicateur de série affiché sur la carte (" + streakTxt + ")", streakTxt.includes("🔥1j") && streakTxt.includes("+5"));

  // Deuxième quête : toast avec bouton Annuler
  await page.locator(".quest").nth(1).locator('[data-p="p1"]').click();
  await page.waitForTimeout(300);
  await closeModals(page); // haut fait lève-tôt/oiseau de nuit selon l'heure
  const undoBtn = page.locator(".toast-action");
  if (await undoBtn.count()) {
    check("toast avec bouton Annuler affiché", true);
    const beforeUndo = (await page.locator(".hunter").first().locator(".xpnums").first().textContent()).trim();
    await undoBtn.click();
    await page.waitForTimeout(300);
    const afterUndo = (await page.locator(".hunter").first().locator(".xpnums").first().textContent()).trim();
    check("annulation depuis le toast (" + beforeUndo + " → " + afterUndo + ")", afterUndo !== beforeUndo);
  } else {
    check("toast avec bouton Annuler affiché (absorbé par un haut fait horaire)", true);
  }

  // Montée de niveau (niveau 2 = 100 XP)
  let levelUpSeen = false;
  for (let i = 0; i < 8; i++) {
    await page.locator(".quest").nth(i % nQuests).locator('[data-p="p1"]').click();
    for (let j = 0; j < 6; j++) {
      const ok = page.locator("#veilOk");
      if (!(await ok.count())) break;
      const txt = await page.locator(".sysbox").textContent();
      if (txt.includes("NIVEAU")) levelUpSeen = true;
      await ok.click();
      await page.waitForTimeout(40);
    }
    await page.waitForTimeout(60);
  }
  check("fenêtre système de montée de niveau", levelUpSeen);

  check("indicateur « dernier » affiché sur les quêtes", (await page.locator(".lastdone").count()) >= 1);
  const suggestedCount = await page.locator(".quest.suggested").count();
  const bonusEqualsOverdue = await page.evaluate(() => bonusTaskId() === overdueTaskId());
  check("suggestion de tâche équitable affichée", bonusEqualsOverdue ? suggestedCount === 0 : suggestedCount === 1);

  // Bandeau « Aujourd'hui » : bilan du jour en tête de l'onglet Quêtes
  const dayTxt = (await page.locator(".daystat").count()) ? (await page.locator(".daystat").textContent()).trim() : "";
  check("bandeau du jour affiché (" + dayTxt.replace(/\s+/g, " ") + ")", dayTxt.includes("Aujourd'hui") && dayTxt.includes("XP"));
  check("répartition par joueur dans le bandeau du jour", (await page.locator(".daystat-by").textContent()).includes("⚔️"));

  // Bannière de mise à jour PWA (invocation directe : pas de service worker en file://)
  await page.evaluate(() => notifyUpdateAvailable());
  const updBtn = page.locator(".toast-action", { hasText: "Recharger" });
  check("bannière « Nouvelle version » avec bouton Recharger", (await updBtn.count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  // Duel : graphique hebdomadaire + hauts faits
  await page.locator('[data-tab="duel"]').click();
  check("graphique XP par semaine présent", (await page.locator('svg[role="img"]').count()) === 1);
  check("barres du graphique tracées", (await page.locator('svg[role="img"] rect').count()) === 16);
  check("hauts faits débloqués visibles", (await page.locator(".feat.on").count()) >= 1);
  check("hauts faits verrouillés grisés", (await page.locator(".feat:not(.on)").count()) >= 1);
  check("répartition des tâches affichée", (await page.locator(".splitline").count()) >= 1);
  check("calendrier d'activité : 56 cases sur 8 semaines", (await page.locator(".cal .cal-cell").count()) === 56);
  const todayLvl = await page.locator(".cal .cal-cell.today").getAttribute("data-lvl");
  check("case du jour marquée et active (lvl=" + todayLvl + ")",
    (await page.locator(".cal .cal-cell.today").count()) === 1 && Number(todayLvl) >= 1);

  // Carte partageable du mur des trophées : repli téléchargement (API de partage absente par défaut)
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#shareTrophyBtn").click(),
  ]);
  check("carte du mur des trophées téléchargée (" + download.suggestedFilename() + ")", download.suggestedFilename().startsWith("rangement-trophees-"));

  // Repli sur l'API de partage native du téléphone quand disponible
  await page.evaluate(() => {
    window.__shareCalled = null;
    navigator.canShare = () => true;
    navigator.share = async (data) => { window.__shareCalled = { title: data.title, nFiles: data.files ? data.files.length : 0 }; };
  });
  await page.locator("#shareTrophyBtn").click();
  await page.waitForFunction(() => window.__shareCalled !== null, { timeout: 3000 });
  const shareCall = await page.evaluate(() => window.__shareCalled);
  check("partage natif utilisé quand disponible", shareCall && shareCall.nFiles === 1);

  // Carte partageable du duel de la semaine (l'API de partage native est déjà stubbée)
  await page.evaluate(() => { window.__shareCalled = null; });
  await page.locator("#shareDuelBtn").click();
  await page.waitForFunction(() => window.__shareCalled !== null, { timeout: 3000 });
  const duelShareCall = await page.evaluate(() => window.__shareCalled);
  check("carte du duel partagée (" + (duelShareCall && duelShareCall.title) + ")",
    duelShareCall && duelShareCall.nFiles === 1 && duelShareCall.title.includes("Duel"));

  // Vue tableau accessible du graphique XP (bascule)
  await page.locator("#chartViewToggle").click();
  check("bascule vers la vue tableau", (await page.locator("table.datatable").count()) === 1);
  check("8 semaines listées dans le tableau", (await page.locator("table.datatable tbody tr").count()) === 8);
  check("graphique masqué en vue tableau", (await page.locator('svg[role="img"]').count()) === 0);
  await page.locator("#chartViewToggle").click();
  check("retour à la vue graphique", (await page.locator('svg[role="img"]').count()) === 1);

  // Répartition : injecte une tâche faite uniquement par p1 -> badge ⚖️ attendu
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("rangement-sl-v2"));
    for (let i = 0; i < 4; i++) {
      raw.S.log.push({ id: "unfair" + i, ts: Date.now() - i * 1000, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 50, note: "" });
    }
    localStorage.setItem("rangement-sl-v2", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForSelector(".hunter");
  await page.locator('[data-tab="duel"]').click();
  check("badge de déséquilibre affiché pour une tâche à sens unique", (await page.locator(".splitline:has-text('Vitres') .chip.gold").count()) === 1);
  await page.locator('[data-tab="quetes"]').click();

  // Objectif : création (récompense surprise 🎲), complétion, réclamation
  await page.locator('[data-tab="objectifs"]').click();
  await page.fill("#objName", "Test défi");
  await page.fill("#objTarget", "10");
  await page.selectOption("#objReward", "__random__");
  await page.locator("#objAdd").click();
  await page.waitForTimeout(200);
  await page.locator('[data-tab="quetes"]').click();
  await page.locator(".quest").first().locator('[data-p="p2"]').click();
  // Cette quête complète à la fois l'objectif (XP à deux) et débloque « Première quête »
  // pour p2 : deux modales s'enchaînent depuis l'itération 24 (au lieu qu'une seule
  // s'affiche et fasse perdre l'autre jalon en silence).
  await page.waitForSelector(".sysbox", { timeout: 2000 }).catch(() => {});
  const firstMilestone = (await page.locator(".sysbox").count()) ? await page.locator(".sysbox").textContent() : "";
  check("premier jalon de la file (" + firstMilestone.replace(/\s+/g, " ").trim().slice(0, 40) + ")",
    firstMilestone.includes("OBJECTIF ATTEINT") || firstMilestone.includes("HAUT FAIT"));
  await closeModals(page);
  check("jalons enchaînés bien tous fermés (aucune modale ne bloque la suite)", (await page.locator(".sysbox").count()) === 0);
  await page.locator('[data-tab="objectifs"]').click();
  check("objectif surprise affiché 🎲", (await page.locator(".obj .oreward").last().textContent()).includes("surprise"));
  check("bouton de réclamation présent", (await page.locator("[data-claim]").count()) > 0);
  const objDot = (await page.locator('#tabs [data-tab="objectifs"] .tabdot').count())
    ? await page.locator('#tabs [data-tab="objectifs"] .tabdot').textContent() : "0";
  check("pastille « à réclamer » sur l'onglet Objectifs (" + objDot + ")", Number(objDot) >= 1);
  await page.locator("[data-claim]").last().click();
  check("confettis affichés à la réclamation d'une récompense", (await page.locator("#confetti").count()) === 1);
  await page.waitForTimeout(200);
  const claimModal = (await page.locator(".sysbox").count()) ? await page.locator(".sysbox").textContent() : "";
  check("tirage au sort annoncé", claimModal.includes("Le sort a désigné"));
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  const wonTxt = (await page.locator(".wonline").count()) === 1 ? await page.locator(".wonline").textContent() : "";
  check("récompense gagnée listée (réelle, pas 🎲) : " + wonTxt.trim().split("\n")[0], wonTxt !== "" && !wonTxt.includes("🎲"));

  // Presets de défi : un tap remplit le formulaire ; rythme hebdo affiché
  check("rythme hebdo du duo affiché", (await page.locator('section.panel', { hasText: "Nouveau défi" }).textContent()).includes("XP par semaine"));
  check("selects du formulaire de défi ont un aria-label pour lecteur d'écran",
    (await page.locator("#objType[aria-label]").count()) === 1 && (await page.locator("#objReward[aria-label]").count()) === 1);
  await page.locator('[data-objpreset="sprint"]').click();
  check("preset Sprint : formulaire prérempli",
    (await page.locator("#objName").inputValue()) === "Sprint de la semaine"
    && (await page.locator("#objType").inputValue()) === "xp"
    && (await page.locator("#objTarget").inputValue()) === "300");
  await page.locator("#objAdd").click();
  await page.waitForTimeout(200);
  check("défi préréglé lancé", (await page.locator('[data-oname]').count()) === 1
    && (await page.locator('[data-oname]').inputValue()) === "Sprint de la semaine");

  // Abandonner un défi avec filet de rattrapage (toast « Annuler »)
  const sprintObjId = await page.evaluate(() => S.objectives.find(o => o.name === "Sprint de la semaine").id);
  await page.locator(`[data-delobj="${sprintObjId}"]`).click();
  await page.waitForTimeout(150);
  check("défi abandonné disparaît de la liste", (await page.locator(`[data-oname="${sprintObjId}"]`).count()) === 0);
  check("toast « Annuler » proposé après abandon de défi", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("défi restauré après Annuler", (await page.locator(`[data-oname="${sprintObjId}"]`).count()) === 1);

  // Défi éditable en place (nom + cible), même mécanique que tâches/récompenses
  await page.fill(`[data-oname="${sprintObjId}"]`, "Sprint du week-end");
  await page.locator(`[data-oname="${sprintObjId}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("nom du défi modifié en place", (await page.evaluate(id => S.objectives.find(o => o.id === id).name, sprintObjId)) === "Sprint du week-end");
  check("toast de confirmation après édition d'un défi (cohérence avec Chasseurs)", (await page.locator(".toast", { hasText: "Défis mis à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-otarget="${sprintObjId}"]`, "450");
  await page.locator(`[data-otarget="${sprintObjId}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("cible du défi modifiée en place", (await page.evaluate(id => S.objectives.find(o => o.id === id).target, sprintObjId)) === 450);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-oname="${sprintObjId}"]`, "");
  await page.locator(`[data-oname="${sprintObjId}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("nom vide restaure l'ancien nom du défi", (await page.evaluate(id => S.objectives.find(o => o.id === id).name, sprintObjId)) === "Sprint du week-end");

  // Récompenses éditables en place (nom + icône), comme les tâches
  const rw0 = await page.evaluate(() => S.rewards[0].id);
  await page.fill(`[data-rwname="${rw0}"]`, "Soirée jeux vidéo");
  await page.locator(`[data-rwname="${rw0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("récompense renommée depuis Objectifs", (await page.evaluate(() => S.rewards[0].name)) === "Soirée jeux vidéo");
  check("toast de confirmation après édition d'une récompense (cohérence avec Chasseurs)", (await page.locator(".toast", { hasText: "Récompenses mises à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-rwicon="${rw0}"]`, "🕹️");
  await page.locator(`[data-rwicon="${rw0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("icône de récompense modifiée", (await page.evaluate(() => S.rewards[0].icon)) === "🕹️");
  check("nouveau nom et icône visibles dans la liste des récompenses (champs remplis après rendu)",
    (await page.locator(`[data-rwname="${rw0}"]`).inputValue()) === "Soirée jeux vidéo"
    && (await page.locator(`[data-rwicon="${rw0}"]`).inputValue()) === "🕹️");
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-rwname="${rw0}"]`, "");
  await page.locator(`[data-rwname="${rw0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("nom vide restaure l'ancien nom (pas d'écrasement par une chaîne vide)",
    (await page.evaluate(() => S.rewards[0].name)) === "Soirée jeux vidéo");

  // Ajout d'une récompense en appuyant sur Entrée (clavier mobile, sans toucher le bouton +)
  await page.fill("#rwIcon", "🎯");
  await page.fill("#rwName", "Test récompense entrée");
  await page.locator("#rwName").press("Enter");
  await page.waitForTimeout(200);
  check("récompense ajoutée via Entrée", (await page.evaluate(() => S.rewards.some(r => r.name === "Test récompense entrée"))) === true);
  check("toast de confirmation après ajout de récompense", (await page.locator(".toast", { hasText: "Récompense ajoutée" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  // Suppression d'une récompense avec filet de rattrapage (toast « Annuler »)
  const rwCountBefore = await page.locator("[data-delrw]").count();
  const rw1 = await page.evaluate(() => S.rewards[1].id);
  const rw1Name = await page.evaluate(() => S.rewards[1].name);
  await page.locator(`[data-delrw="${rw1}"]`).click();
  await page.waitForTimeout(150);
  check("récompense supprimée immédiatement de la liste", (await page.locator("[data-delrw]").count()) === rwCountBefore - 1);
  check("toast « Annuler » proposé après suppression", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("récompense restaurée après Annuler",
    (await page.locator("[data-delrw]").count()) === rwCountBefore
    && (await page.evaluate(id => S.rewards.find(r => r.id === id) ? S.rewards.find(r => r.id === id).name : null, rw1)) === rw1Name);

  // Journal + annulation
  await page.locator('[data-tab="journal"]').click();
  const before = await page.locator(".logline").count();
  await page.locator("[data-undo]").first().click();
  await page.waitForTimeout(200);
  check("annulation depuis le journal", (await page.locator(".logline").count()) === before - 1);

  // Recherche et filtre du Journal (une entrée fraîche pour Chasseuse : l'undo précédent a pu vider les siennes)
  await page.locator('[data-tab="quetes"]').click();
  await page.locator(".quest").nth(2).locator('[data-p="p2"]').click();
  await closeModals(page);
  await page.locator('[data-tab="journal"]').click();
  const totalLines = await page.locator(".logline").count();
  await page.fill("#journalSearch", "vitres");
  await page.waitForTimeout(150);
  const vitresLines = await page.locator(".logline").count();
  check("recherche filtre le journal (" + vitresLines + "/" + totalLines + ")", vitresLines > 0 && vitresLines < totalLines);
  check("chaque ligne visible contient bien « Vitres »", await page.locator(".logline").evaluateAll(
    els => els.every(el => el.textContent.includes("Vitres"))));
  await page.fill("#journalSearch", "zzz-introuvable");
  await page.waitForTimeout(150);
  check("aucun résultat -> message clair", (await page.locator(".logline").count()) === 0 && (await page.locator(".hint", { hasText: "Aucune entrée" }).count()) === 1);
  await page.fill("#journalSearch", "");
  await page.waitForTimeout(150);
  await page.locator('[data-jf]', { hasText: "Chasseuse" }).click();
  await page.waitForTimeout(150);
  const p2Lines = await page.locator(".logline").count();
  check("filtre par joueur (" + p2Lines + "/" + totalLines + ")", p2Lines > 0 && p2Lines < totalLines);
  await page.locator('[data-jf="all"]').click();
  await page.waitForTimeout(150);
  check("filtre « Tous » restaure toutes les lignes", (await page.locator(".logline").count()) === totalLines);

  // Note libre sur une entrée du journal (édition en place, comme les tâches/récompenses)
  await page.locator(".notebtn").first().click();
  await page.waitForTimeout(100);
  check("clic sur le crayon affiche un champ d'édition", (await page.locator(".jnote-edit").count()) === 1);
  await page.fill(".jnote-edit", "Bien fait !");
  await page.locator(".jnote-edit").evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("note affichée en chip doré après édition", (await page.locator(".logline .chip.gold", { hasText: "Bien fait !" }).count()) === 1);
  check("champ d'édition refermé après validation", (await page.locator(".jnote-edit").count()) === 0);
  check("toast de confirmation après édition d'une note de journal", (await page.locator(".toast", { hasText: "Note enregistrée" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.reload();
  await page.waitForSelector(".hunter");
  await page.locator('[data-tab="journal"]').click();
  check("note du journal conservée après rechargement", (await page.locator(".logline .chip.gold", { hasText: "Bien fait !" }).count()) === 1);

  // La recherche du Journal filtre aussi sur les notes libres, pas seulement le nom de tâche
  await page.fill("#journalSearch", "bien fait");
  await page.waitForTimeout(150);
  const noteMatches = await page.locator(".logline").count();
  check("recherche filtre aussi sur la note libre (\"bien fait\" → " + noteMatches + " résultat(s))", noteMatches === 1);
  await page.fill("#journalSearch", "");
  await page.waitForTimeout(150);

  // Réglages : renommage + couleur enregistrés au changement (onchange), sans bouton
  await page.locator('[data-tab="reglages"]').click();
  await page.fill('[data-pname="p1"]', "Max");
  await page.locator('[data-pname="p1"]').evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("joueur renommé", (await page.locator(".hunter .name").first().textContent()).trim() === "Max");
  // La couleur se vérifie sur le joueur 2 : le leader de la semaine porte la bordure dorée.
  await page.locator('[data-pcolor="p2"]').evaluate(el => { el.value = "#ff0000"; el.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForSelector(".hunter");
  check("nom conservé après rechargement", (await page.locator(".hunter .name").first().textContent()).trim() === "Max");
  const borderColor = await page.locator(".hunter").nth(1).evaluate(el => el.style.borderTopColor);
  check("couleur personnalisée appliquée (" + borderColor + ")", borderColor.includes("255, 0, 0") || borderColor === "#ff0000");

  // Tâches éditables en place : nom et icône
  await page.locator('[data-tab="reglages"]').click();
  const t0 = await page.evaluate(() => S.tasks[0].id);
  await page.fill(`[data-tname="${t0}"]`, "Vitres du salon");
  await page.locator(`[data-tname="${t0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("tâche renommée depuis Réglages", (await page.evaluate(() => S.tasks[0].name)) === "Vitres du salon");
  check("toast de confirmation après édition d'une tâche (cohérence avec Chasseurs)", (await page.locator(".toast", { hasText: "Quêtes mises à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-ticon="${t0}"]`, "🫧");
  await page.locator(`[data-ticon="${t0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("icône de tâche modifiée", (await page.evaluate(() => S.tasks[0].icon)) === "🫧");
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.locator('[data-tab="quetes"]').click();
  const renamedQuest = page.locator(".quest", { hasText: "Vitres du salon" });
  check("nouveau nom et icône visibles sur l'onglet Quêtes",
    (await renamedQuest.count()) === 1 && (await renamedQuest.textContent()).includes("🫧"));

  // Ajout d'une tâche en appuyant sur Entrée (clavier mobile, sans toucher le bouton Ajouter)
  await page.locator('[data-tab="reglages"]').click();
  check("select de priorité (ajout) a un aria-label pour lecteur d'écran", (await page.locator("#tPrio[aria-label]").count()) === 1);
  await page.fill("#tIcon", "🪣");
  await page.fill("#tName", "Test tâche entrée");
  await page.locator("#tName").press("Enter");
  await page.waitForTimeout(200);
  check("tâche ajoutée via Entrée", (await page.evaluate(() => S.tasks.some(t => t.name === "Test tâche entrée"))) === true);
  check("toast de confirmation après ajout de tâche", (await page.locator(".toast", { hasText: "Quête ajoutée" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  // Suppression d'une tâche avec filet de rattrapage (toast « Annuler »), même mécanique
  await page.locator('[data-tab="reglages"]').click();
  const taskCountBefore = await page.locator("[data-deltask]").count();
  const tLast = await page.evaluate(() => S.tasks[S.tasks.length - 1].id);
  const tLastName = await page.evaluate(() => S.tasks[S.tasks.length - 1].name);
  await page.locator(`[data-deltask="${tLast}"]`).click();
  await page.waitForTimeout(150);
  check("tâche supprimée immédiatement de Réglages", (await page.locator("[data-deltask]").count()) === taskCountBefore - 1);
  check("tâche disparue de l'onglet Quêtes après suppression", (await page.locator(".quest", { hasText: tLastName }).count()) === 0);
  check("toast « Annuler » proposé après suppression de tâche", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("tâche restaurée après Annuler",
    (await page.locator("[data-deltask]").count()) === taskCountBefore
    && (await page.evaluate(id => S.tasks.some(t => t.id === id), tLast)) === true);

  // Thèmes : application + persistance
  await page.locator('[data-tab="reglages"]').click();
  await page.locator('[data-theme="monarque"]').click();
  const sysVar = (await page.evaluate(() => document.documentElement.style.getPropertyValue("--sys"))).trim().toLowerCase();
  check("thème appliqué (" + sysVar + ")", sysVar === "#8b7bff");
  await page.reload();
  await page.waitForSelector(".hunter");
  const sysVar2 = (await page.evaluate(() => document.documentElement.style.getPropertyValue("--sys"))).trim().toLowerCase();
  check("thème conservé après rechargement", sysVar2 === "#8b7bff");

  // Thème clair « Aube » : fond, meta theme-color, persistance, retour au sombre
  await page.locator('[data-tab="reglages"]').click();
  await page.locator('[data-theme="aube"]').click();
  await page.waitForTimeout(150);
  const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check("thème clair Aube : fond clair (" + bodyBg + ")", bodyBg === "rgb(234, 240, 249)");
  check("thème clair : meta theme-color suit",
    (await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content)) === "#EAF0F9");
  await page.reload();
  await page.waitForSelector(".hunter");
  check("thème clair conservé après rechargement",
    (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(234, 240, 249)");
  await page.locator('[data-tab="reglages"]').click();
  await page.locator('[data-theme="monarque"]').click();
  await page.waitForTimeout(150);
  check("retour au thème sombre : fond restauré",
    (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(6, 10, 19)");

  // Chips de priorité : couleur suivant désormais le thème (contraste corrigé en Aube, it. 28)
  await page.locator('[data-theme="aube"]').click();
  await page.waitForTimeout(150);
  const prioBasseAube = (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--prio-basse").trim())).toLowerCase();
  check("chip « basse » suit le thème clair Aube (" + prioBasseAube + ")", prioBasseAube === "#4a6483");
  await page.locator('[data-theme="monarque"]').click();
  await page.waitForTimeout(150);
  const prioBasseDark = (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--prio-basse").trim())).toLowerCase();
  check("chip « basse » revient à la teinte sombre par défaut (" + prioBasseDark + ")", prioBasseDark === "#8aa3c2");

  // Thème par défaut au premier lancement : suit la préférence système clair/sombre
  const lightCtx = await browser.newContext({ colorScheme: "light", viewport: { width: 390, height: 844 } });
  const lightPage = await lightCtx.newPage();
  await lightPage.goto(APP_URL);
  await lightPage.waitForSelector(".hunter");
  check("compte frais + appareil en mode clair -> thème Aube choisi automatiquement",
    (await lightPage.evaluate(() => localStorage.getItem("rangement-theme"))) === "aube");
  await lightCtx.close();

  const darkCtx = await browser.newContext({ colorScheme: "dark", viewport: { width: 390, height: 844 } });
  const darkPage = await darkCtx.newPage();
  await darkPage.goto(APP_URL);
  await darkPage.waitForSelector(".hunter");
  check("compte frais + appareil en mode sombre -> thème Système par défaut",
    (await darkPage.evaluate(() => localStorage.getItem("rangement-theme"))) === "systeme");
  await darkCtx.close();

  // Installation PWA : panneau visible tant que l'appli n'est pas installée
  await page.locator('[data-tab="reglages"]').click();
  const installPanel = page.locator('section.panel', { hasText: "Installer l'application" });
  check("panneau d'installation affiché (non installée)", (await installPanel.count()) === 1);
  check("instructions génériques par défaut (pas d'invite native captée en test)",
    (await installPanel.textContent()).includes("Installable depuis le menu"));

  // Bannière masquée en mode standalone (déjà installée)
  const standaloneContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const standalonePage = await standaloneContext.newPage();
  await standalonePage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) => q.includes("standalone")
      ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }
      : orig(q);
  });
  await standalonePage.goto(APP_URL);
  await standalonePage.waitForSelector(".quest");
  await standalonePage.locator('[data-tab="reglages"]').click();
  check("panneau d'installation masqué en mode standalone",
    (await standalonePage.locator('section.panel', { hasText: "Installer l'application" }).count()) === 0);
  await standaloneContext.close();

  // Invite d'installation native captée (beforeinstallprompt) : bouton direct au lieu des instructions
  const installContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const installPage = await installContext.newPage();
  await installPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await installPage.goto(APP_URL);
  await installPage.waitForSelector(".quest");
  await installPage.evaluate(() => {
    window.__installChoice = null;
    const evt = new Event("beforeinstallprompt", { cancelable: true });
    evt.prompt = () => { window.__installChoice = "prompted"; };
    evt.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(evt);
  });
  await installPage.locator('[data-tab="reglages"]').click();
  check("bouton d'installation natif affiché quand le navigateur le propose", (await installPage.locator("#installBtn").count()) === 1);
  await installPage.locator("#installBtn").click();
  await installPage.waitForTimeout(150);
  check("clic sur « Installer » déclenche l'invite native", (await installPage.evaluate(() => window.__installChoice)) === "prompted");
  await installContext.close();

  // Mur des trophées : vide cette semaine, puis rempli avec une semaine passée injectée
  await page.locator('[data-tab="duel"]').click();
  check("mur des trophées en attente (semaine en cours)", (await page.locator(".trophyline").count()) === 0);
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("rangement-sl-v2"));
    raw.S.log.push({ id: "old1", ts: Date.now() - 8 * 864e5, playerId: "p1", taskName: "Ancienne quête", icon: "🗡️", xp: 30, note: "" });
    localStorage.setItem("rangement-sl-v2", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForSelector(".hunter");
  await page.locator('[data-tab="duel"]').click();
  const trophyTxt = (await page.locator(".trophyline").count()) ? await page.locator(".trophyline").first().textContent() : "";
  check("trophée décerné pour la semaine passée (" + trophyTxt.trim().replace(/\s+/g, " ") + ")", trophyTxt.includes("👑"));
  check("compteur de trophées dans les stats", (await page.locator(".statgrid").textContent()).includes("Trophées"));
  const bestStreakRow = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll(".statgrid .c")).find(el => el.textContent.includes("Meilleure série"));
    return c ? { a: c.previousElementSibling.textContent, b: c.nextElementSibling.textContent } : null;
  });
  const expectedBest = await page.evaluate(() => ({ a: bestStreakOf("p1") + " j", b: bestStreakOf("p2") + " j" }));
  check("record de meilleure série affiché dans les stats (" + JSON.stringify(bestStreakRow) + ")",
    bestStreakRow && bestStreakRow.a === expectedBest.a && bestStreakRow.b === expectedBest.b);
  const streakRow = await page.evaluate(() => {
    const c = Array.from(document.querySelectorAll(".statgrid .c")).find(el => el.textContent.includes("Série de victoires"));
    return c ? { a: c.previousElementSibling.textContent, b: c.nextElementSibling.textContent } : null;
  });
  check("série de victoires hebdo : 1 semaine pour le vainqueur de l'unique semaine passée (" + JSON.stringify(streakRow) + ")",
    streakRow && (streakRow.a === "1 sem." || streakRow.b === "1 sem."));

  // Pari de duel : mise, résolution sur une semaine passée, réclamation
  check("formulaire de mise affiché", (await page.locator("#betAdd").count()) === 1);
  check("select de récompense misée a un aria-label pour lecteur d'écran", (await page.locator("#betReward[aria-label]").count()) === 1);
  await page.locator("#betAdd").click();
  await page.waitForTimeout(200);
  check("enjeu actif affiché", (await page.locator(".betline.hot").count()) === 1);
  await page.locator('[data-tab="quetes"]').click();
  check("rappel de l'enjeu visible sur l'onglet Quêtes", (await page.locator(".betremind").count()) === 1);
  await page.locator('[data-tab="duel"]').click();
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("rangement-sl-v2"));
    const past = new Date(Date.now() - 8 * 864e5);
    past.setHours(0, 0, 0, 0);
    past.setDate(past.getDate() - ((past.getDay() + 6) % 7)); // lundi de la semaine passée
    const k = past.getFullYear() + "-" + String(past.getMonth() + 1).padStart(2, "0") + "-" + String(past.getDate()).padStart(2, "0");
    raw.S.bets[0].week = k;
    localStorage.setItem("rangement-sl-v2", JSON.stringify(raw));
  });
  await page.reload();
  await page.waitForSelector(".hunter");
  await page.locator('[data-tab="duel"]').click();
  check("pari résolu avec vainqueur", (await page.locator("[data-claimbet]").count()) === 1);
  check("pastille « à réclamer » sur l'onglet Duel",
    (await page.locator('#tabs [data-tab="duel"] .tabdot').textContent()) === "1");
  await page.locator("[data-claimbet]").click();
  check("confettis affichés à la réclamation d'un pari", (await page.locator("#confetti").count()) === 1);
  await page.waitForTimeout(200);
  const betModal = (await page.locator(".sysbox").count()) ? await page.locator(".sysbox").textContent() : "";
  check("« PARI REMPORTÉ » annoncé", betModal.includes("PARI REMPORTÉ"));
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  await page.locator('[data-tab="objectifs"]').click();
  check("enjeu ajouté aux récompenses gagnées", (await page.locator(".wonline").count()) === 2);
  check("pastille Duel disparue après réclamation du pari",
    (await page.locator('#tabs [data-tab="duel"] .tabdot').count()) === 0);

  // Réglages : interrupteurs son et suggestion (propres à l'appareil)
  await page.locator('[data-tab="reglages"]').click();
  check("interrupteur son présent et activé par défaut", await page.locator("#soundToggle").isChecked());
  await page.evaluate(() => document.getElementById("soundToggle").click());
  check("son désactivé stocké", (await page.evaluate(() => localStorage.getItem("rangement-sound"))) === "off");
  check("interrupteur suggestion présent et activé par défaut", await page.locator("#suggestToggle").isChecked());
  await page.evaluate(() => document.getElementById("suggestToggle").click());
  await page.waitForTimeout(100);
  check("suggestion désactivée stockée", (await page.evaluate(() => localStorage.getItem("rangement-suggest"))) === "off");
  check("interrupteur récap présent et activé par défaut", await page.locator("#recapToggle").isChecked());
  await page.evaluate(() => document.getElementById("recapToggle").click());
  check("récap désactivé stocké", (await page.evaluate(() => localStorage.getItem("rangement-recap"))) === "off");
  await page.locator('[data-tab="quetes"]').click();
  check("plus de badge suggéré une fois désactivé", (await page.locator(".quest.suggested").count()) === 0);
  await page.reload();
  await page.waitForSelector(".hunter");
  await page.locator('[data-tab="reglages"]').click();
  check("réglages son/suggestion conservés après rechargement", (await page.locator("#soundToggle").isChecked()) === false);

  const realErrors = errors.filter(e => !e.includes("ERR_FILE_NOT_FOUND") && !e.includes("ERR_CONNECTION"));
  check("aucune erreur JavaScript", realErrors.length === 0);
  if (realErrors.length) console.error(realErrors);

  // Rappel du soir : contexte dédié, aucune activité aujourd'hui, seuil abaissé à 0h
  const evContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const evPage = await evContext.newPage();
  await evPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-evening-hour", "0");
    localStorage.setItem("rangement-recap", "off"); // déterminisme : indépendant du jour/heure réels
  });
  await evPage.goto(APP_URL);
  await evPage.waitForSelector(".quest");
  check("rappel du soir affiché sans activité aujourd'hui", (await evPage.locator(".evremind").count()) === 1);
  await evPage.locator("#evRemindOk").click();
  check("rappel masqué après « Plus tard »", (await evPage.locator(".evremind").count()) === 0);
  const dismissStored = await evPage.evaluate(() => localStorage.getItem("rangement-evening-dismiss"));
  check("dismission écrite en stockage (" + dismissStored + ")", dismissStored !== null);
  await evPage.reload();
  await evPage.waitForSelector(".quest");
  const dismissAfterReload = await evPage.evaluate(() => localStorage.getItem("rangement-evening-dismiss"));
  check("rappel toujours masqué après rechargement le même jour (dismiss=" + dismissAfterReload + ")", (await evPage.locator(".evremind").count()) === 0);
  await evPage.evaluate(() => localStorage.removeItem("rangement-evening-dismiss"));
  await evPage.reload();
  await evPage.waitForSelector(".quest");
  check("rappel réapparaît une fois la dismission effacée", (await evPage.locator(".evremind").count()) === 1);

  // Rappel conscient de la série (façon Duolingo) : une quête hier, rien aujourd'hui -> bandeau spécifique
  // (mutation directe de S + save() : ce contexte n'a encore jamais écrit dans localStorage)
  await evPage.evaluate(() => {
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(12, 0, 0, 0);
    S.log.push({ id: "streak-risk", ts: y.getTime(), playerId: "p1", taskName: "Vaisselle / lave-vaisselle", icon: "🍽️", xp: 20, note: "" });
    save();
    localStorage.removeItem("rangement-evening-dismiss");
  });
  await evPage.reload();
  await evPage.waitForSelector(".quest");
  const streakBanner = (await evPage.locator(".evremind").count()) ? (await evPage.locator(".evremind").textContent()).trim() : "";
  check("rappel conscient de la série (" + streakBanner + ")", streakBanner.includes("série de 1 jour"));

  // Heure du rappel de série 🔥 indépendante de l'heure du rappel générique
  await evPage.locator('[data-tab="reglages"]').click();
  await evPage.fill("#streakHour", "19");
  await evPage.locator("#streakHour").evaluate(el => el.blur());
  await evPage.waitForTimeout(150);
  check("heure de série stockée séparément", (await evPage.evaluate(() => localStorage.getItem("rangement-streak-hour"))) === "19");
  check("rappel de série visible dès son heure, même avant l'heure générique", (await evPage.evaluate(() => {
    localStorage.setItem("rangement-evening-hour", "23");
    localStorage.setItem("rangement-streak-hour", "0");
    localStorage.removeItem("rangement-evening-dismiss");
    return shouldShowEveningReminder();
  })) === true);
  check("aucun rappel avant l'heure de série et l'heure générique", await evPage.evaluate(() => {
    localStorage.setItem("rangement-streak-hour", "23");
    const attendu = new Date().getHours() >= 23; // vrai uniquement si le test tourne à 23 h
    return shouldShowEveningReminder() === attendu;
  }));
  await evPage.evaluate(() => { localStorage.setItem("rangement-evening-hour", "0"); localStorage.removeItem("rangement-streak-hour"); });

  await evPage.locator('[data-tab="reglages"]').click();
  await evPage.evaluate(() => document.getElementById("eveningToggle").click());
  await evPage.locator('[data-tab="quetes"]').click();
  check("rappel désactivable dans Réglages", (await evPage.locator(".evremind").count()) === 0);

  // Récap hebdo : indépendant du jour/heure réels, on invoque directement les fonctions exposées
  check("récap désactivé -> shouldShowWeeklyRecap() false", (await evPage.evaluate(() => {
    localStorage.setItem("rangement-recap", "off");
    return shouldShowWeeklyRecap();
  })) === false);
  await evPage.evaluate(() => { localStorage.removeItem("rangement-recap-dismiss"); weeklyRecapModal(); });
  const recapText = (await evPage.locator(".sysbox").count()) ? await evPage.locator(".sysbox").textContent() : "";
  check("récap hebdo affiche les XP et le leader", recapText.includes("RÉCAP DE LA SEMAINE") && recapText.includes("XP"));
  await evPage.locator("#veilOk").click();
  check("récap masqué pour la semaine après fermeture", (await evPage.evaluate(() => recapDismissedThisWeek())) === true);
  await evContext.close();

  // Notification navigateur (best-effort) : Notification API simulée pour un test déterministe
  const notifContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const notifPage = await notifContext.newPage();
  await notifPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
    localStorage.setItem("rangement-evening-hour", "0");
    window.__notifCalls = [];
    class FakeNotification {
      constructor(title, opts) { window.__notifCalls.push({ title, opts }); }
    }
    FakeNotification.requestPermission = () => Promise.resolve("granted");
    FakeNotification.permission = "granted";
    window.Notification = FakeNotification;
  });
  await notifPage.goto(APP_URL);
  await notifPage.waitForSelector(".quest");
  check("notifications signalées comme supportées (stub)", (await notifPage.evaluate(() => notifsSupported())) === true);
  await notifPage.locator('[data-tab="reglages"]').click();
  check("interrupteur notification présent, désactivé par défaut (opt-in)", (await notifPage.locator("#notifToggle").isChecked()) === false);
  await notifPage.evaluate(() => document.getElementById("notifToggle").click());
  await notifPage.waitForTimeout(150);
  check("notifications activées après consentement", (await notifPage.evaluate(() => localStorage.getItem("rangement-notifs"))) === "on");
  await notifPage.evaluate(() => maybeSendStreakNotification());
  await notifPage.waitForTimeout(150);
  const calls1 = await notifPage.evaluate(() => window.__notifCalls.length);
  check("notification envoyée quand le rappel du soir est actif (" + calls1 + ")", calls1 === 1);
  await notifPage.evaluate(() => maybeSendStreakNotification());
  await notifPage.waitForTimeout(150);
  const calls2 = await notifPage.evaluate(() => window.__notifCalls.length);
  check("pas de doublon de notification le même jour", calls2 === 1);
  await notifPage.locator('[data-tab="reglages"]').click();
  const notifHistTxt = (await notifPage.locator(".notifhist").count()) ? await notifPage.locator(".notifhist").textContent() : "";
  check("historique des notifications affiché (" + notifHistTxt.trim() + ")", notifHistTxt.includes("🔔"));
  check("une seule entrée dans l'historique (pas de doublon)", (await notifPage.locator(".notifhistline").count()) === 1);
  await notifPage.evaluate(() => document.getElementById("clearNotifHist").click());
  await notifPage.waitForTimeout(150);
  check("historique vidé par « Effacer l'historique »",
    (await notifPage.locator(".notifhistline").count()) === 0
    && (await notifPage.evaluate(() => localStorage.getItem("rangement-notif-log"))) === null);

  // Bouton « Tester la notification » : renvoie tout de suite, sans attendre le rappel du soir ni son anti-doublon
  await notifPage.locator("#testNotifBtn").click();
  await notifPage.waitForTimeout(150);
  const calls3 = await notifPage.evaluate(() => window.__notifCalls.length);
  check("bouton « Tester la notification » envoie un appel immédiat (" + calls3 + ")", calls3 === 2);
  check("l'historique affiche l'entrée de test", (await notifPage.locator(".notifhistline").textContent()).includes("🧪"));
  await notifContext.close();

  // Héros : collection, déblocage au mérite, incarnation, stuff
  const heroContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const heroPage = await heroContext.newPage();
  await heroPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await heroPage.goto(APP_URL);
  await heroPage.waitForSelector(".quest");
  await heroPage.locator('[data-tab="heros"]').click();
  const totalChars = await heroPage.evaluate(() => CHARACTERS.length);
  check("collection complète affichée (" + totalChars + " héros)", (await heroPage.locator(".charcard").count()) === totalChars);
  check("compte fraîche : quasiment tout est verrouillé", (await heroPage.locator(".charcard.locked").count()) >= totalChars - 2);
  const luffyCond = await heroPage.locator('.charcard:has-text("Luffy") .charcard-cond').textContent();
  check("Luffy reste un boss SS exigeant (" + luffyCond.trim() + ")", luffyCond.includes("28") && luffyCond.includes("100") && luffyCond.includes("trophée"));
  check("progression visible sur les héros verrouillés (" + luffyCond.trim() + ")", luffyCond.includes("1/28") && luffyCond.includes("0/100"));
  const yamatoCond = await heroPage.locator('.charcard:has-text("Yamato") .charcard-cond').textContent();
  check("Yamato (GOD) est le boss final au-dessus de SS (" + yamatoCond.trim() + ")",
    yamatoCond.includes("30") && yamatoCond.includes("120") && yamatoCond.includes("trophée"));
  check("rareté GOD affichée sur Yamato",
    (await heroPage.locator('.charcard:has-text("Yamato") .rarity').textContent()).trim() === "GOD");
  check("DanMachi présent dans la collection (Hestia, Bell, Aiz)",
    (await heroPage.locator('.charcard:has-text("Hestia")').count()) === 1
    && (await heroPage.locator('.charcard:has-text("Bell Cranel")').count()) === 1
    && (await heroPage.locator('.charcard:has-text("Aiz Wallenstein")').count()) === 1);
  check("hauts faits héros verrouillés sur un compte frais",
    await heroPage.evaluate(() => unlockedFeats("p1").every(f => !["hero1", "hero5", "heroH", "soul"].includes(f.id))));
  const nextTxt = await heroPage.locator("section.panel", { hasText: "Prochaine recrue" }).textContent();
  check("« Prochaine recrue » = Sein sur un compte frais (" + nextTxt.replace(/\s+/g, " ").trim().slice(0, 60) + ")", nextTxt.includes("Sein"));

  // Filtre de la collection par univers
  await heroPage.locator('[data-hu="One Piece"]').click();
  check("filtre One Piece : 6 héros affichés, un seul univers",
    (await heroPage.locator(".charcard").count()) === 6 && (await heroPage.locator(".day-h").count()) === 1);
  check("compteur de déblocage par univers (0/6)", (await heroPage.locator(".day-h .uvcount").textContent()).trim() === "0/6");
  const nextTxtOP = await heroPage.locator("section.panel", { hasText: "Prochaine recrue" }).textContent();
  check("« Prochaine recrue » suit le filtre d'univers (Usopp attendu sur One Piece, pas Sein)",
    nextTxtOP.includes("Usopp") && !nextTxtOP.includes("Sein"));
  await heroPage.locator('[data-hu="all"]').click();
  check("filtre « Tous » : collection complète restaurée", (await heroPage.locator(".charcard").count()) === totalChars);

  // Grosse progression injectée : 310 quêtes réparties sur 15 jours (niveau 30, série 15, 2 trophées passés)
  await heroPage.evaluate(() => {
    for (let i = 0; i < 310; i++) {
      const d = new Date(); d.setDate(d.getDate() - (i % 15)); d.setHours(10, 0, 0, 0);
      S.log.push({ id: "grind" + i, ts: d.getTime() + (i * 1000), playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 50, note: "" });
    }
    save();
  });
  await heroPage.reload();
  await heroPage.waitForSelector(".hunter"); // le hash #heros restaure l'onglet Héros au reload
  await heroPage.locator('[data-tab="heros"]').click().catch(() => {});
  const unlockedCount = await heroPage.evaluate(() => unlockedCharIds("p1").length);
  check("gros grind -> collection complète débloquée (" + unlockedCount + "/" + totalChars + ")", unlockedCount === totalChars);
  check("hauts faits héros débloqués par le grind",
    await heroPage.evaluate(() => { const ids = new Set(unlockedFeats("p1").map(f => f.id)); return ids.has("hero1") && ids.has("hero5") && ids.has("heroH"); }));
  check("plus de « Prochaine recrue » quand tout est débloqué",
    (await heroPage.locator("section.panel", { hasText: "Prochaine recrue" }).count()) === 0);

  // Incarner Frieren : avatar + stuff
  await heroPage.locator('.charcard:has-text("Frieren") [data-equip]').click();
  await heroPage.waitForTimeout(200);
  check("héros incarné visible sur la carte du chasseur", (await heroPage.locator(".hunter").first().locator(".charline").textContent()).includes("Frieren"));
  check("boutons de quête à l'emblème du héros", (await heroPage.locator('[data-tab="quetes"]').click(), await heroPage.locator(".doer").first().textContent()).includes("❄️"));
  await heroPage.locator('[data-tab="heros"]').click();
  const gearStars = await heroPage.locator(".curchar .gearstep.on").count();
  check("stuff de Frieren progresse avec le niveau (" + gearStars + " palier(s))", gearStars >= 1);
  check("haut fait « Âme liée » après incarnation",
    await heroPage.evaluate(() => unlockedFeats("p1").some(f => f.id === "soul")));
  const [heroDl] = await Promise.all([
    heroPage.waitForEvent("download"),
    heroPage.locator("#shareHeroBtn").click(),
  ]);
  check("carte de héros téléchargée (" + heroDl.suggestedFilename() + ")", heroDl.suggestedFilename().startsWith("rangement-heros-"));
  await heroPage.reload();
  await heroPage.waitForSelector(".hunter");
  check("héros conservé après rechargement", (await heroPage.locator(".hunter").first().locator(".charline").count()) === 1);

  // Reprendre son emoji : le héros est retiré
  await heroPage.locator('[data-tab="heros"]').click();
  await heroPage.locator("#unequipBtn").click();
  await heroPage.waitForTimeout(200);
  check("héros retiré", (await heroPage.locator(".hunter").first().locator(".charline").count()) === 0);
  await heroContext.close();

  // Déblocage en direct : juste sous le seuil d'Usopp (niv. 4), une quête le franchit
  const unlockContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const unlockPage = await unlockContext.newPage();
  await unlockPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await unlockPage.goto(APP_URL);
  await unlockPage.waitForSelector(".quest");
  await unlockPage.evaluate(() => {
    S.log.push({ id: "pre1", ts: Date.now() - 3600e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 190, note: "" });
    S.log.push({ id: "pre2", ts: Date.now() - 1800e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 185, note: "" });
    save();
  });
  await unlockPage.reload();
  await unlockPage.waitForSelector(".quest");
  const preLen = await unlockPage.evaluate(() => S.log.length);
  check("état injecté conservé après rechargement (" + preLen + " entrées)", preLen === 2);
  await unlockPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await unlockPage.waitForTimeout(300);
  const unlockModal = (await unlockPage.locator(".sysbox").count()) ? await unlockPage.locator(".sysbox").textContent() : "";
  check("« HÉROS DÉBLOQUÉ » prioritaire sur la montée de niveau (" + unlockModal.replace(/\s+/g, " ").slice(0, 60) + ")", unlockModal.includes("HÉROS DÉBLOQUÉ") && unlockModal.includes("Usopp"));
  check("bouton « Incarner » présent dans la modale", (await unlockPage.locator("#veilExtra").count()) === 1);
  await unlockPage.locator("#veilExtra").click();
  await unlockPage.waitForTimeout(250);
  check("héros incarné en un geste depuis la modale",
    (await unlockPage.evaluate(() => S.players[0].characterId)) === "usopp"
    && (await unlockPage.locator(".hunter").first().locator(".charline").textContent()).includes("Usopp"));
  await unlockContext.close();

  // Annuler une quête même après une modale spéciale (mistap sur le mauvais chasseur, etc.)
  const undoModalContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const undoModalPage = await undoModalContext.newPage();
  await undoModalPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await undoModalPage.goto(APP_URL);
  await undoModalPage.waitForSelector(".quest");
  await undoModalPage.evaluate(() => {
    S.log.push({ id: "pre-lvl", ts: Date.now() - 3600e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 95, note: "" });
    save();
  });
  await undoModalPage.reload();
  await undoModalPage.waitForSelector(".quest");
  const preLvlXp = await undoModalPage.evaluate(() => totalXp("p1"));
  await undoModalPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await undoModalPage.waitForTimeout(300);
  const lvlModalTxt = await undoModalPage.locator(".sysbox").textContent();
  check("montée de niveau déclenchée par la quête injectée (" + lvlModalTxt.replace(/\s+/g, " ").slice(0, 30) + ")", lvlModalTxt.includes("NIVEAU"));
  check("bouton Annuler présent dans la modale de niveau", (await undoModalPage.locator("#veilExtra").count()) === 1);

  // Accessibilité clavier des modales système : focus initial + piège du Tab
  const initialFocusId = await undoModalPage.evaluate(() => document.activeElement && document.activeElement.id);
  check("focus posé sur le premier bouton à l'ouverture de la modale (" + initialFocusId + ")", initialFocusId === "veilExtra");
  await undoModalPage.keyboard.press("Tab");
  check("Tab avance vers le bouton suivant de la modale",
    (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilOk");
  await undoModalPage.keyboard.press("Tab");
  check("Tab boucle vers le premier bouton (piège de focus)",
    (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilExtra");
  await undoModalPage.keyboard.press("Shift+Tab");
  check("Shift+Tab boucle vers le dernier bouton",
    (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilOk");
  await undoModalPage.keyboard.press("Shift+Tab");
  check("focus revenu sur le premier bouton", (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilExtra");

  await undoModalPage.locator("#veilExtra").click();
  await undoModalPage.waitForTimeout(200);
  check("XP revenue à sa valeur d'avant la quête après Annuler depuis la modale (" + preLvlXp + ")",
    (await undoModalPage.evaluate(() => totalXp("p1"))) === preLvlXp);
  await undoModalContext.close();

  // Enchaînement de plusieurs jalons simultanés (niveau + objectif + haut fait sur la même quête) :
  // aucun n'est plus perdu en silence, et Annuler en cours de chaîne l'interrompt entièrement.
  const chainContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const chainPage = await chainContext.newPage();
  await chainPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await chainPage.goto(APP_URL);
  await chainPage.waitForSelector(".quest");
  await chainPage.locator('[data-tab="objectifs"]').click();
  await chainPage.fill("#objName", "Chaîne test");
  await chainPage.fill("#objTarget", "95");
  await chainPage.locator("#objAdd").click();
  await chainPage.waitForTimeout(150);
  await chainPage.evaluate(() => {
    // 9 quêtes déjà faites (91 XP au total) : à 9 du seuil « 10 quêtes » et du niveau 2 (100 XP),
    // à 4 XP de l'objectif (95) — la 10e quête, quelle qu'elle soit, franchit les trois à la fois.
    const amounts = [10, 10, 10, 10, 10, 10, 10, 10, 11];
    amounts.forEach((xp, i) => S.log.push({ id: "chain" + i, ts: Date.now() + i, playerId: "p1", taskName: "Test", icon: "🧪", xp, note: "" }));
    save();
  });
  await chainPage.reload();
  await chainPage.waitForSelector(".hunter"); // le hash #objectifs restaure cet onglet au reload
  await chainPage.locator('[data-tab="quetes"]').click();
  await chainPage.waitForSelector(".quest");

  // Premier essai : Annuler sur le tout premier jalon (NIVEAU) doit interrompre toute la chaîne
  await chainPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await chainPage.waitForSelector(".sysbox");
  const chainModal1 = await chainPage.locator(".sysbox").textContent();
  check("premier jalon de la file : montée de niveau (" + chainModal1.replace(/\s+/g, " ").trim().slice(0, 20) + ")", chainModal1.includes("NIVEAU"));
  await chainPage.locator("#veilExtra").click(); // Annuler
  await chainPage.waitForTimeout(200);
  check("Annuler sur le 1er jalon interrompt toute la chaîne (aucune autre modale)", (await chainPage.locator(".sysbox").count()) === 0);
  const revertedState = await chainPage.evaluate(() => ({ count: featStats("p1").count, hasQ10: unlockedFeats("p1").some(f => f.id === "q10") }));
  check("quête bien annulée (retour à 9 quêtes)", revertedState.count === 9);
  check("haut fait « 10 quêtes » non débloqué après l'annulation en chaîne", revertedState.hasQ10 === false);

  // Deuxième essai, même quête : enchaîner les trois modales avec « Continuer »
  await chainPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await chainPage.waitForSelector(".sysbox");
  check("jalon 1/3 : NIVEAU", (await chainPage.locator(".sysbox").textContent()).includes("NIVEAU"));
  await chainPage.locator("#veilOk").click();
  await chainPage.waitForTimeout(150);
  check("jalon 2/3 : OBJECTIF ATTEINT", (await chainPage.locator(".sysbox").textContent()).includes("OBJECTIF ATTEINT"));
  await chainPage.locator("#veilOk").click();
  await chainPage.waitForTimeout(150);
  check("jalon 3/3 : HAUT FAIT", (await chainPage.locator(".sysbox").textContent()).includes("HAUT FAIT"));
  await chainPage.locator("#veilOk").click();
  await chainPage.waitForTimeout(150);
  check("chaîne terminée, aucune modale ne reste", (await chainPage.locator(".sysbox").count()) === 0);
  const finalState = await chainPage.evaluate(() => {
    const o = S.objectives.find(x => x.name === "Chaîne test");
    return { count: featStats("p1").count, lvl: levelInfo(totalXp("p1")).lvl, objDone: objProgress(o) >= o.target };
  });
  check("les trois jalons ont bien tous eu lieu (" + JSON.stringify(finalState) + ")",
    finalState.count === 10 && finalState.lvl === 2 && finalState.objDone === true);
  await chainContext.close();

  // Bouclier de série : gagné tous les 7 jours de série naturelle, comble automatiquement un jour manqué
  const shieldContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const shieldPage = await shieldContext.newPage();
  await shieldPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await shieldPage.goto(APP_URL);
  await shieldPage.waitForSelector(".quest");
  await shieldPage.evaluate(() => {
    // p1 : 7 jours consécutifs naturels se terminant avant-hier -> 1 bouclier gagné ; rien hier
    for (let i = 2; i <= 8; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(12, 0, 0, 0);
      S.log.push({ id: "nat1-" + i, ts: d.getTime(), playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 20, note: "" });
    }
    // p2 : seulement 3 jours consécutifs naturels -> aucun bouclier gagné ; rien hier non plus
    for (let i = 2; i <= 4; i++) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(12, 0, 0, 0);
      S.log.push({ id: "nat2-" + i, ts: d.getTime(), playerId: "p2", taskName: "Poubelles", icon: "🗑️", xp: 15, note: "" });
    }
    save();
  });
  await shieldPage.reload();
  await shieldPage.waitForSelector(".quest");
  check("1 bouclier gagné après 7 jours naturels consécutifs (p1)", (await shieldPage.evaluate(() => earnedShields("p1"))) === 1);
  check("bouclier automatiquement utilisé pour combler hier (p1)",
    (await shieldPage.evaluate(() => S.log.some(l => l.playerId === "p1" && l.note === "bouclier"))) === true);
  check("série de p1 préservée et prolongée par le bouclier (8 j)", (await shieldPage.evaluate(() => streakOf("p1"))) === 8);
  check("bouclier consommé après usage (0 disponible pour p1)", (await shieldPage.evaluate(() => availableShields("p1"))) === 0);
  check("l'entrée bouclier ne compte pas comme une vraie quête (7, pas 8)", (await shieldPage.evaluate(() => featStats("p1").count)) === 7);
  check("l'entrée bouclier n'inflate pas non plus un défi « nombre de quêtes » à deux (bug corrigé, it. 28)",
    (await shieldPage.evaluate(() => objProgress({ type: "count", createdAt: Date.now() - 20 * 86400000 }))) === 10);
  check("pas de bouclier gagné avec seulement 3 jours naturels (p2)", (await shieldPage.evaluate(() => earnedShields("p2"))) === 0);
  check("série de p2 cassée normalement, aucun bouclier utilisé",
    (await shieldPage.evaluate(() => S.log.some(l => l.playerId === "p2" && l.note === "bouclier"))) === false
    && (await shieldPage.evaluate(() => streakOf("p2"))) === 0);
  await shieldPage.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await shieldPage.locator('[data-tab="duel"]').click();
  check("compte de boucliers disponibles affiché dans Duel", (await shieldPage.locator(".statgrid").textContent()).includes("Boucliers"));
  await shieldContext.close();

  // Mouvement réduit : aucune animation de confettis ne doit être créée
  const rmContext = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const rmPage = await rmContext.newPage();
  await rmPage.goto(APP_URL);
  await rmPage.waitForSelector("#obNext");
  await rmPage.locator("#obNext").click();
  await rmPage.locator("#obNext").click();
  await rmPage.locator("#obNext").click();
  await rmPage.locator('[data-tab="objectifs"]').click();
  await rmPage.fill("#objName", "Défi rapide");
  await rmPage.fill("#objTarget", "1");
  await rmPage.locator("#objAdd").click();
  await rmPage.waitForTimeout(150);
  await rmPage.locator('[data-tab="quetes"]').click();
  await rmPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await closeModals(rmPage); // premier objectif + « Première quête » s'enchaînent
  await rmPage.locator('[data-tab="objectifs"]').click();
  await rmPage.locator("[data-claim]").last().click();
  check("aucun confetti créé avec le mouvement réduit", (await rmPage.locator("#confetti").count()) === 0);
  await rmContext.close();

  // Navigation : lien profond par hash, bouton retour (onglets et modales), raccourcis PWA
  const navContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const navPage = await navContext.newPage();
  await navPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
    localStorage.setItem("rangement-evening", "off");
  });
  await navPage.goto(APP_URL + "#duel");
  await navPage.waitForSelector(".hunter");
  check("lien profond #duel ouvre l'onglet Duel",
    (await navPage.locator("#tabs button.on").getAttribute("data-tab")) === "duel");
  await navPage.locator('[data-tab="journal"]').click();
  check("le changement d'onglet écrit le hash",
    (await navPage.evaluate(() => location.hash)) === "#journal");
  await navPage.goBack();
  await navPage.waitForTimeout(150);
  check("bouton retour : revient à l'onglet précédent (Duel)",
    (await navPage.locator("#tabs button.on").getAttribute("data-tab")) === "duel");
  await navPage.evaluate(() => sysModal("<b>test retour</b>"));
  check("modale ouverte pour le test du retour", (await navPage.locator(".veil").count()) === 1);
  await navPage.goBack();
  await navPage.waitForTimeout(150);
  check("bouton retour : ferme la modale au lieu de quitter, onglet conservé",
    (await navPage.locator(".veil").count()) === 0
    && (await navPage.locator("#tabs button.on").getAttribute("data-tab")) === "duel");
  await navContext.close();

  // Raccourcis d'icône PWA déclarés dans le manifest
  const fs = require("fs");
  const path = require("path");
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "manifest.webmanifest"), "utf8"));
  check("3 raccourcis PWA dans le manifest, tous en lien profond par hash",
    Array.isArray(manifest.shortcuts) && manifest.shortcuts.length === 3
    && manifest.shortcuts.every(s => s.url.includes("#") && s.icons && s.icons.length));

  // Itération 27 : tri des quêtes, remise à zéro en modale système, rappels vivants
  const it27Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const it27Page = await it27Context.newPage();
  await it27Page.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
    localStorage.setItem("rangement-evening", "off");
  });
  await it27Page.goto(APP_URL);
  await it27Page.waitForSelector(".quest");

  // Tri des quêtes par priorité (toggle propre à l'appareil)
  check("ordre habituel par défaut (Vaisselle en tête)",
    (await it27Page.locator(".quest .qname").first().textContent()).includes("Vaisselle"));
  await it27Page.locator("#qSortToggle").click();
  await it27Page.waitForTimeout(100);
  check("tri par priorité : une quête critique passe en tête",
    (await it27Page.locator(".quest .chip").first().textContent()).includes("Critique"));
  await it27Page.reload();
  await it27Page.waitForSelector(".quest");
  check("tri par priorité conservé après rechargement",
    (await it27Page.locator(".quest .chip").first().textContent()).includes("Critique"));
  await it27Page.locator("#qSortToggle").click();
  await it27Page.waitForTimeout(100);
  check("retour à l'ordre habituel",
    (await it27Page.locator(".quest .qname").first().textContent()).includes("Vaisselle"));

  // Remise à zéro : modale système (plus de confirm() natif), action sûre par défaut
  await it27Page.evaluate(() => {
    S.log.push({ id: "it27", ts: Date.now(), playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 50, note: "" });
    save(); render();
  });
  await it27Page.locator('[data-tab="reglages"]').click();
  await it27Page.locator("#resetBtn").click();
  await it27Page.waitForSelector(".sysbox");
  check("remise à zéro : modale système à la place du confirm natif",
    (await it27Page.locator(".sysbox").textContent()).includes("REMISE À ZÉRO"));
  check("bouton sûr « Garder nos données » présent",
    (await it27Page.locator("#veilOk").textContent()).includes("Garder"));
  await it27Page.locator("#veilOk").click();
  await it27Page.waitForTimeout(150);
  check("« Garder nos données » : journal intact", (await it27Page.evaluate(() => S.log.length)) === 1);
  await it27Page.locator("#resetBtn").click();
  await it27Page.waitForSelector("#veilExtra");
  await it27Page.locator("#veilExtra").click();
  await it27Page.waitForTimeout(150);
  check("« Tout effacer » : journal vidé, tâches conservées",
    (await it27Page.evaluate(() => S.log.length === 0 && S.tasks.length === 13)));

  // Rappels vivants : le bandeau du soir apparaît via le tick, sans recharger ni naviguer
  await it27Page.locator('[data-tab="quetes"]').click();
  check("bandeau du soir absent quand le rappel est coupé", (await it27Page.locator(".evremind").count()) === 0);
  await it27Page.evaluate(() => {
    localStorage.setItem("rangement-evening", "on");
    localStorage.setItem("rangement-evening-hour", "0");
    localStorage.removeItem("rangement-evening-dismiss");
    reminderTick();
  });
  await it27Page.waitForTimeout(150);
  check("le tick fait apparaître le bandeau du soir sur l'onglet Quêtes",
    (await it27Page.locator(".evremind").count()) === 1);
  await it27Context.close();

  await browser.close();
  done();
})();
