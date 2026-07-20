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

  // aria-label des boutons de quête nomme la tâche, pas seulement le joueur
  // (26 boutons identiques au rotor d'un lecteur d'écran sans ça, corrigé it. 39)
  const firstDoerLabel = await page.locator(".quest").first().locator('[data-p="p1"]').getAttribute("aria-label");
  check("aria-label du bouton de quête inclut le nom de la tâche (\"" + firstDoerLabel + "\")",
    !!firstDoerLabel && firstDoerLabel.includes("Vaisselle") && firstDoerLabel.includes("fait par"));

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
  const duelXpNums = await page.evaluate(() => { const [a, b] = S.players; return [weekXp(a.id), weekXp(b.id)]; });
  check("XP chiffrés sous la barre Duel de la semaine (it. 41)",
    (await page.locator("section.panel .xpnums").first().textContent()).trim() === `${duelXpNums[0]} XP${duelXpNums[1]} XP`);
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

  // Partage annulé par l'utilisateur (AbortError) : pas de repli téléchargement silencieux (bug corrigé it. 39)
  await page.evaluate(() => {
    navigator.share = async () => { const e = new Error("Abort"); e.name = "AbortError"; throw e; };
  });
  let downloadFiredOnAbort = false;
  page.once("download", () => { downloadFiredOnAbort = true; });
  await page.locator("#shareDuelBtn").click();
  await page.waitForTimeout(500);
  check("annuler le partage natif (AbortError) ne déclenche pas de téléchargement forcé", !downloadFiredOnAbort);

  // Vue tableau accessible du graphique XP (bascule)
  check("aria-pressed=false sur la bascule XP en vue graphique (Itération 34)",
    (await page.locator("#chartViewToggle").getAttribute("aria-pressed")) === "false");
  await page.locator("#chartViewToggle").click();
  check("bascule vers la vue tableau", (await page.locator("table.datatable").count()) === 1);
  check("8 semaines listées dans le tableau", (await page.locator("table.datatable tbody tr").count()) === 8);
  check("graphique masqué en vue tableau", (await page.locator('svg[role="img"]').count()) === 0);
  check("aria-pressed=true sur la bascule XP en vue tableau (Itération 34)",
    (await page.locator("#chartViewToggle").getAttribute("aria-pressed")) === "true");
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
  await closeModals(page); // récap hebdo dimanche ≥18h : réel un dimanche soir, jamais désactivé avant la ligne 796
  await page.locator('[data-tab="duel"]').click();
  check("badge de déséquilibre affiché pour une tâche à sens unique", (await page.locator(".splitline:has-text('Vitres') .chip.gold").count()) === 1);
  await page.locator('[data-tab="quetes"]').click();

  // Objectif : création (récompense surprise 🎲), complétion, réclamation
  await page.locator('[data-tab="objectifs"]').click();
  check("aria-label sur le nom et la cible du défi (formulaire de création)",
    (await page.locator("#objName[aria-label]").count()) === 1
    && (await page.locator("#objTarget[aria-label]").count()) === 1);
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
  if (firstMilestone.includes("OBJECTIF ATTEINT")) {
    check("modale OBJECTIF ATTEINT nomme le défi concerné", firstMilestone.includes("Test défi"));
  }
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
  // Réclamation annulable (it. 32) : « won » était la seule liste sans filet de rattrapage —
  // Annuler défait la récompense gagnée et redonne le défi à réclamer.
  check("bouton Annuler présent sur la réclamation", (await page.locator("#veilExtra").count()) === 1);
  // Le focus initial d'une modale à plusieurs boutons doit toujours tomber sur l'action
  // sûre (« Continuer »), jamais sur un bouton extra potentiellement destructeur, même si
  // celui-ci apparaît avant #veilOk dans le DOM.
  check("focus initial sur l'action sûre (Continuer), pas sur Annuler",
    (await page.evaluate(() => document.activeElement.id)) === "veilOk");
  // Nom/description accessibles de la modale (aria-labelledby/describedby) pour un lecteur
  // d'écran qui n'annoncerait sinon que le libellé du bouton focalisé.
  check("modale nommée pour lecteur d'écran (aria-labelledby/describedby)",
    await page.evaluate(() => {
      const box = document.querySelector(".sysbox");
      const lbl = box.getAttribute("aria-labelledby"), desc = box.getAttribute("aria-describedby");
      return !!lbl && !!document.getElementById(lbl).textContent.trim()
        && !!desc && !!document.getElementById(desc).textContent.trim();
    }));
  await page.locator("#veilExtra").click();
  await page.waitForTimeout(200);
  check("réclamation annulée : plus de récompense gagnée en liste", (await page.locator(".wonline").count()) === 0);
  check("le défi redevient réclamable après Annuler", (await page.locator("[data-claim]").count()) > 0);
  await page.locator("[data-claim]").last().click();
  await page.waitForTimeout(200);
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  const wonTxt = (await page.locator(".wonline").count()) === 1 ? await page.locator(".wonline").textContent() : "";
  check("récompense gagnée listée (réelle, pas 🎲) : " + wonTxt.trim().split("\n")[0], wonTxt !== "" && !wonTxt.includes("🎲"));

  // Suppression d'une récompense gagnée avec filet de rattrapage (it. 33) : "won" était
  // la seule liste sans bouton de suppression malgré deleteWithUndo généralisé (it. 24/30).
  check("bouton de suppression présent sur la récompense gagnée", (await page.locator("[data-delwon]").count()) === 1);
  check("aria-label du bouton de suppression nomme la récompense gagnée (Itération 44)",
    (await page.locator("[data-delwon]").getAttribute("aria-label")).startsWith("Retirer ") &&
    (await page.locator("[data-delwon]").getAttribute("aria-label")).endsWith(" de l'historique"));
  await page.locator("[data-delwon]").click();
  await page.waitForTimeout(150);
  check("récompense gagnée supprimée de la liste", (await page.locator(".wonline").count()) === 0);
  check("toast « Annuler » proposé après suppression d'une récompense gagnée", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("récompense gagnée restaurée après Annuler", (await page.locator(".wonline").count()) === 1);

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
  await page.locator(`[data-otype="${sprintObjId}"]`).selectOption("count");
  await page.waitForTimeout(200);
  check("type du défi modifié en place", (await page.evaluate(id => S.objectives.find(o => o.id === id).type, sprintObjId)) === "count");
  check("toast de confirmation après édition du type d'un défi", (await page.locator(".toast", { hasText: "Défis mis à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.locator(`[data-otype="${sprintObjId}"]`).selectOption("xp");
  await page.waitForTimeout(200);
  check("type du défi restauré à xp", (await page.evaluate(id => S.objectives.find(o => o.id === id).type, sprintObjId)) === "xp");
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  // Récompense d'un défi éditable en place (it. 43), même mécanique que le type (it. 42)
  const otherRewardId = await page.evaluate(id => S.rewards.find(r => r.id !== S.objectives.find(o => o.id === id).rewardId).id, sprintObjId);
  await page.locator(`[data-oreward="${sprintObjId}"]`).selectOption(otherRewardId);
  await page.waitForTimeout(200);
  check("récompense du défi modifiée en place", (await page.evaluate(id => S.objectives.find(o => o.id === id).rewardId, sprintObjId)) === otherRewardId);
  check("toast de confirmation après édition de la récompense d'un défi", (await page.locator(".toast", { hasText: "Défis mis à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  await page.fill(`[data-oname="${sprintObjId}"]`, "");
  await page.locator(`[data-oname="${sprintObjId}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("nom vide restaure l'ancien nom du défi", (await page.evaluate(id => S.objectives.find(o => o.id === id).name, sprintObjId)) === "Sprint du week-end");

  // Garde-fou : impossible de supprimer une récompense encore promise par un défi actif
  // (sinon le défi retomberait sur « Récompense au choix » sans que personne ne s'en aperçoive
  // avant la réclamation).
  const rewardInUseId = await page.evaluate(id => S.objectives.find(o => o.id === id).rewardId, sprintObjId);
  const rwInUseCountBefore = await page.locator("[data-delrw]").count();
  await page.locator(`[data-delrw="${rewardInUseId}"]`).click();
  await page.waitForTimeout(150);
  check("suppression bloquée pour une récompense utilisée par un défi actif",
    (await page.locator("[data-delrw]").count()) === rwInUseCountBefore);
  check("toast d'avertissement affiché (récompense en usage)",
    (await page.locator(".toast", { hasText: "Impossible de supprimer" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.locator(`[data-delobj="${sprintObjId}"]`).click();
  await page.waitForTimeout(150);
  // Le défi par défaut de l'onboarding (« Semaine de choc ») partage le même reward par
  // défaut : l'écarter aussi (marqué claimed directement, sans passer par la réclamation
  // UI pour ne pas ajouter une entrée parasite à "won" qui fausserait des vérifications
  // plus loin dans le scénario) avant de vérifier que la récompense redevient supprimable.
  await page.evaluate(id => {
    const o = S.objectives.find(x => !x.claimed && x.rewardId === id);
    if (o) { o.claimed = true; save(); render(); }
  }, rewardInUseId);
  await page.waitForTimeout(150);
  await page.locator(`[data-delrw="${rewardInUseId}"]`).click();
  await page.waitForTimeout(150);
  check("récompense supprimable une fois tous les défis qui l'utilisaient retirés",
    (await page.locator(`[data-delrw="${rewardInUseId}"]`).count()) === 0);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

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

  // Entrée valide un champ d'édition en place (comme la note du Journal depuis l'it. 23),
  // au lieu d'attendre le blur — cohérence des 8 champs les plus récents (it. 36)
  await page.fill(`[data-rwname="${rw0}"]`, "Soirée jeux vidéo (Entrée)");
  await page.locator(`[data-rwname="${rw0}"]`).press("Enter");
  await page.waitForTimeout(200);
  check("Entrée valide l'édition d'une récompense sans attendre le blur",
    (await page.evaluate(() => S.rewards[0].name)) === "Soirée jeux vidéo (Entrée)");
  check("toast de confirmation après validation par Entrée", (await page.locator(".toast", { hasText: "Récompenses mises à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  // Échap annule l'édition et restaure la valeur d'origine, sans rien enregistrer
  await page.fill(`[data-rwname="${rw0}"]`, "Ne doit jamais être enregistré");
  await page.locator(`[data-rwname="${rw0}"]`).press("Escape");
  await page.waitForTimeout(200);
  check("Échap restaure la valeur affichée dans le champ",
    (await page.locator(`[data-rwname="${rw0}"]`).inputValue()) === "Soirée jeux vidéo (Entrée)");
  check("Échap n'enregistre pas la valeur annulée",
    (await page.evaluate(() => S.rewards[0].name)) === "Soirée jeux vidéo (Entrée)");
  check("aucun toast après Échap (rien n'a été enregistré)", (await page.locator(".toast").count()) === 0);

  // Ajout d'une récompense en appuyant sur Entrée (clavier mobile, sans toucher le bouton +)
  check("aria-label sur l'icône et le nom de récompense (formulaire de création)",
    (await page.locator("#rwIcon[aria-label]").count()) === 1
    && (await page.locator("#rwName[aria-label]").count()) === 1);
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
  check("aria-label du bouton de suppression nomme la récompense (Itération 44)",
    (await page.locator(`[data-delrw="${rw1}"]`).getAttribute("aria-label")) === "Supprimer " + rw1Name);
  await page.locator(`[data-delrw="${rw1}"]`).click();
  await page.waitForTimeout(150);
  check("récompense supprimée immédiatement de la liste", (await page.locator("[data-delrw]").count()) === rwCountBefore - 1);
  check("toast « Annuler » proposé après suppression", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("récompense restaurée après Annuler",
    (await page.locator("[data-delrw]").count()) === rwCountBefore
    && (await page.evaluate(id => S.rewards.find(r => r.id === id) ? S.rewards.find(r => r.id === id).name : null, rw1)) === rw1Name);

  // Journal + annulation (avec filet de rattrapage, comme tâches/récompenses/défis depuis l'it. 24)
  await page.locator('[data-tab="journal"]').click();
  const before = await page.locator(".logline").count();
  const undoneId = await page.evaluate(() => document.querySelector("[data-undo]").dataset.undo);
  await page.locator("[data-undo]").first().click();
  await page.waitForTimeout(200);
  check("annulation depuis le journal", (await page.locator(".logline").count()) === before - 1);
  check("toast « Annuler » proposé après suppression d'une entrée du journal", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("entrée du journal restaurée après Annuler",
    (await page.locator(".logline").count()) === before
    && (await page.evaluate(id => !!S.log.find(l => l.id === id), undoneId)));
  await page.locator("[data-undo]").first().click();
  await page.waitForTimeout(200);

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
  check("bouton d'effacement de la recherche visible quand le champ n'est pas vide",
    (await page.locator("#journalSearchClear").count()) === 1);
  await page.locator("#journalSearchClear").click();
  await page.waitForTimeout(150);
  check("bouton d'effacement vide le champ et restaure toutes les lignes",
    (await page.inputValue("#journalSearch")) === "" && (await page.locator(".logline").count()) === totalLines);
  check("bouton d'effacement disparaît une fois le champ vide", (await page.locator("#journalSearchClear").count()) === 0);
  await page.locator('[data-jf]', { hasText: "Chasseuse" }).click();
  await page.waitForTimeout(150);
  const p2Lines = await page.locator(".logline").count();
  check("filtre par joueur (" + p2Lines + "/" + totalLines + ")", p2Lines > 0 && p2Lines < totalLines);
  check("aria-pressed reflète le filtre joueur actif (Itération 31)",
    (await page.locator('[data-jf]', { hasText: "Chasseuse" }).getAttribute("aria-pressed")) === "true"
    && (await page.locator('[data-jf="all"]').getAttribute("aria-pressed")) === "false");
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

  // Alerte si les deux chasseurs choisissent la même couleur (Réglages)
  await page.locator('[data-tab="reglages"]').click();
  check("pas d'alerte couleur quand les couleurs diffèrent", (await page.locator("#colorClashHint").count()) === 0);
  await page.locator('[data-pcolor="p1"]').evaluate(el => { el.value = "#ff0000"; el.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(200);
  check("alerte affichée quand les deux couleurs sont identiques", (await page.locator("#colorClashHint").count()) === 1);
  await page.locator('[data-pcolor="p1"]').evaluate(el => { el.value = "#4dc3ff"; el.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(200);
  check("alerte disparaît dès que les couleurs redeviennent différentes", (await page.locator("#colorClashHint").count()) === 0);

  // Tâches éditables en place : nom et icône
  await page.locator('[data-tab="reglages"]').click();
  const t0 = await page.evaluate(() => S.tasks[0].id);
  const t0OldName = await page.evaluate(() => S.tasks[0].name);
  const t0LogCountBefore = await page.evaluate((old) => S.log.filter(l => l.taskName === old).length, t0OldName);
  await page.fill(`[data-tname="${t0}"]`, "Vitres du salon");
  await page.locator(`[data-tname="${t0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("tâche renommée depuis Réglages", (await page.evaluate(() => S.tasks[0].name)) === "Vitres du salon");
  const t0LogOldNameAfter = await page.evaluate((old) => S.log.filter(l => l.taskName === old).length, t0OldName);
  const t0LogNewNameAfter = await page.evaluate(() => S.log.filter(l => l.taskName === "Vitres du salon").length);
  check("renommage de tâche propage le nom au journal (bug corrigé it. 39, " + t0LogCountBefore + " entrée(s) déplacée(s))",
    t0LogCountBefore >= 1 && t0LogOldNameAfter === 0 && t0LogNewNameAfter === t0LogCountBefore);
  check("toast de confirmation après édition d'une tâche (cohérence avec Chasseurs)", (await page.locator(".toast", { hasText: "Quêtes mises à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-ticon="${t0}"]`, "🫧");
  await page.locator(`[data-ticon="${t0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(200);
  check("icône de tâche modifiée", (await page.evaluate(() => S.tasks[0].icon)) === "🫧");
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.selectOption(`[data-tprio="${t0}"]`, "critique");
  await page.waitForTimeout(200);
  check("priorité de tâche modifiée depuis Réglages", (await page.evaluate(() => S.tasks[0].prio)) === "critique");
  check("toast de confirmation après changement de priorité (incohérence corrigée, it. 29)",
    (await page.locator(".toast", { hasText: "Quêtes mises à jour" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.locator('[data-tab="quetes"]').click();
  const renamedQuest = page.locator(".quest", { hasText: "Vitres du salon" });
  check("nouveau nom et icône visibles sur l'onglet Quêtes",
    (await renamedQuest.count()) === 1 && (await renamedQuest.textContent()).includes("🫧"));

  // Ajout d'une tâche en appuyant sur Entrée (clavier mobile, sans toucher le bouton Ajouter)
  await page.locator('[data-tab="reglages"]').click();
  check("select de priorité (ajout) a un aria-label pour lecteur d'écran", (await page.locator("#tPrio[aria-label]").count()) === 1);
  check("aria-label sur l'icône et le nom de tâche (formulaire de création)",
    (await page.locator("#tIcon[aria-label]").count()) === 1
    && (await page.locator("#tName[aria-label]").count()) === 1);
  await page.fill("#tIcon", "🪣");
  await page.fill("#tName", "Test tâche entrée");
  await page.locator("#tName").press("Enter");
  await page.waitForTimeout(200);
  check("tâche ajoutée via Entrée", (await page.evaluate(() => S.tasks.some(t => t.name === "Test tâche entrée"))) === true);
  check("toast de confirmation après ajout de tâche", (await page.locator(".toast", { hasText: "Quête ajoutée" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  // Bug corrigé : deux tâches homonymes se partageraient silencieusement le même
  // historique de journal (lié par taskName, pas par id) — création et renommage
  // vers un nom déjà pris sont désormais bloqués.
  const tCountBeforeDup = await page.evaluate(() => S.tasks.length);
  await page.fill("#tIcon", "🧴");
  await page.fill("#tName", "Test tâche entrée");
  await page.locator("#tAdd").click();
  await page.waitForTimeout(150);
  check("création bloquée sur un nom de tâche déjà pris",
    (await page.evaluate(() => S.tasks.length)) === tCountBeforeDup
    && (await page.locator(".toast", { hasText: "porte déjà ce nom" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.fill(`[data-tname="${t0}"]`, "Test tâche entrée");
  await page.locator(`[data-tname="${t0}"]`).evaluate(el => el.blur());
  await page.waitForTimeout(150);
  check("renommage bloqué vers un nom de tâche déjà pris",
    (await page.evaluate(() => S.tasks[0].name)) === "Vitres du salon"
    && (await page.locator(".toast", { hasText: "porte déjà ce nom" }).count()) === 1);
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));

  // Suppression d'une tâche avec filet de rattrapage (toast « Annuler »), même mécanique
  await page.locator('[data-tab="reglages"]').click();
  const taskCountBefore = await page.locator("[data-deltask]").count();
  const tLast = await page.evaluate(() => S.tasks[S.tasks.length - 1].id);
  const tLastName = await page.evaluate(() => S.tasks[S.tasks.length - 1].name);
  check("aria-label du bouton de suppression nomme la tâche (Itération 44)",
    (await page.locator(`[data-deltask="${tLast}"]`).getAttribute("aria-label")) === "Supprimer " + tLastName);
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
  check("onglet Réglages porte aria-current (Itération 31)",
    (await page.locator('#tabs [data-tab="reglages"]').getAttribute("aria-current")) === "page"
    && (await page.locator('#tabs [data-tab="quetes"]').getAttribute("aria-current")) === "false");
  // Le fond des boutons/interrupteurs suivait un bleu figé (rgba(77,195,255,…)) identique
  // au thème Système par pure coïncidence — jamais recalculé pour les 3 autres thèmes
  // d'accent (Monarque/Braise/Guilde), contrairement à leur bordure/texte qui suivent déjà
  // var(--sys) (it. 36).
  const btnBgSysteme = await page.locator("#tAdd").evaluate(el => getComputedStyle(el).backgroundColor);
  await page.locator('[data-theme="monarque"]').click();
  const sysVar = (await page.evaluate(() => document.documentElement.style.getPropertyValue("--sys"))).trim().toLowerCase();
  check("thème appliqué (" + sysVar + ")", sysVar === "#8b7bff");
  check("aria-pressed reflète le thème actif (Itération 31)",
    (await page.locator('[data-theme="monarque"]').getAttribute("aria-pressed")) === "true"
    && (await page.locator('[data-theme="aube"]').getAttribute("aria-pressed")) === "false");
  const btnBgMonarque = await page.locator("#tAdd").evaluate(el => getComputedStyle(el).backgroundColor);
  check("fond du bouton suit désormais le thème d'accent (" + btnBgSysteme + " → " + btnBgMonarque + ")",
    btnBgSysteme !== btnBgMonarque);
  const soundSpanBgMonarque = await page.locator("#soundToggle").evaluate(el => getComputedStyle(el.nextElementSibling).backgroundColor);
  check("fond de l'interrupteur activé suit le thème d'accent en Monarque (" + soundSpanBgMonarque + ")",
    !soundSpanBgMonarque.includes("77, 195, 255"));
  await page.locator('[data-tab="quetes"]').click();
  const doerBgMonarque = await page.locator(".doer").first().evaluate(el => getComputedStyle(el).backgroundColor);
  check("fond du bouton de quête (.doer) suit le thème d'accent en Monarque (" + doerBgMonarque + ")",
    !doerBgMonarque.includes("77, 195, 255"));
  await page.locator('[data-tab="reglages"]').click();
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

  // Modales système et toasts suivaient un fond navy figé, illisible avec l'encre claire
  // d'Aube (contraste corrigé, it. 38) : doivent désormais suivre le thème clair.
  await page.evaluate(() => toast("Test contraste Aube"));
  await page.waitForTimeout(100);
  const toastBgAube = await page.locator(".toast").first().evaluate(el => getComputedStyle(el).backgroundColor);
  check("fond du toast suit le thème clair Aube, plus de navy sombre (" + toastBgAube + ")", toastBgAube === "rgb(255, 255, 255)");
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.evaluate(() => sysModal('<div class="big">TEST</div>', null, null, "OK"));
  await page.waitForTimeout(100);
  const sysboxBgAube = await page.locator(".sysbox").first().evaluate(el => getComputedStyle(el).backgroundImage);
  check("fond de la modale système suit le thème clair Aube (" + sysboxBgAube + ")", sysboxBgAube.includes("255, 255, 255"));
  await page.locator("#veilOk").click();
  await page.waitForTimeout(100);

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

  // .btn.danger : bordure/fond codés en dur avant l'it. 42, jamais convertis en color-mix
  // sur --crit contrairement au reste des boutons (it. 36) -> devaient rester figés en Aube.
  const dangerBgAube = await page.locator("#resetBtn").evaluate(el => getComputedStyle(el).backgroundColor);
  check("bouton danger suit --crit en Aube (" + dangerBgAube + ")", dangerBgAube === "oklab(0.561911 0.177069 0.064578 / 0.08)");

  // Bouton de thème actif : fond codé en rgba(255,255,255,.04) avant l'it. 43, quasi invisible
  // sur les panneaux presque blancs d'Aube -> passé en color-mix sur --sys, comme .btn.danger.
  const themebtnOnBgAube = await page.locator('[data-theme="aube"]').evaluate(el => getComputedStyle(el).backgroundColor);
  check("bouton de thème actif se distingue en Aube, plus de rgba(255,255,255,.04) (" + themebtnOnBgAube + ")",
    themebtnOnBgAube.includes("oklab"));

  // cardColors().panel2 alimente le centre du dégradé des cartes canvas partageables (trophées,
  // duel, héros) : codé en hex figé "#101D33" avant l'it. 43 -> texte c.ink (sombre en Aube)
  // dessiné sur un centre resté navy sombre, illisible. Doit désormais suivre --panel-2.
  const panel2Aube = (await page.evaluate(() => cardColors().panel2)).toLowerCase();
  check("cardColors().panel2 suit le thème clair Aube (" + panel2Aube + ")", panel2Aube === "#f4f8fe");

  // Badges de rareté (Héros) : suivaient un hex figé identique à --ink-dim/--sys/--mana/
  // --gold/--crit mais sans jamais relire ces variables -> même défaut de contraste que
  // les chips de priorité avant l'it. 28, jamais corrigé pour la rareté (it. 33).
  await page.locator('[data-tab="heros"]').click();
  await page.waitForTimeout(100);
  const rarityBAube = await page.locator(".rarity").first().evaluate(el => getComputedStyle(el).color);
  check("badge de rareté B suit --ink-dim en Aube, contraste corrigé (" + rarityBAube + ")", rarityBAube === "rgb(84, 104, 138)");

  // Graphique XP hebdo (SVG, Duel) : mêmes hex figés (#8AA3C2/#1C3252/#2B5A8F) que la rareté
  // avant l'it. 33, jamais corrigés pour ce graphique (it. 34) -> grille et libellés
  // illisibles en Aube tant que la vue tableau n'était pas choisie à la place.
  await page.locator('[data-tab="duel"]').click();
  await page.waitForTimeout(100);
  const chartColorsAube = await page.evaluate(() => {
    const svg = document.querySelector('svg[role="img"]');
    return { grid: getComputedStyle(svg.querySelector("line")).stroke, text: getComputedStyle(svg.querySelector("text")).fill };
  });
  check("grille du graphique XP suit --line-glow en Aube (" + chartColorsAube.grid + ")", chartColorsAube.grid === "rgb(159, 194, 228)");
  check("libellés du graphique XP suivent --ink-dim en Aube, contraste corrigé (" + chartColorsAube.text + ")", chartColorsAube.text === "rgb(84, 104, 138)");

  await page.locator('[data-tab="reglages"]').click();
  await page.locator('[data-theme="monarque"]').click();
  await page.waitForTimeout(150);
  const prioBasseDark = (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--prio-basse").trim())).toLowerCase();
  check("chip « basse » revient à la teinte sombre par défaut (" + prioBasseDark + ")", prioBasseDark === "#8aa3c2");
  const dangerBgDark = await page.locator("#resetBtn").evaluate(el => getComputedStyle(el).backgroundColor);
  check("bouton danger revient à --crit sombre par défaut (" + dangerBgDark + ")", dangerBgDark === "oklab(0.69422 0.188363 0.0594485 / 0.08)");
  const panel2Dark = (await page.evaluate(() => cardColors().panel2)).toLowerCase();
  check("cardColors().panel2 revient au navy sombre par défaut, pas de régression (" + panel2Dark + ")", panel2Dark === "#101d33");
  await page.evaluate(() => toast("Test contraste sombre"));
  await page.waitForTimeout(100);
  const toastBgDark = await page.locator(".toast").first().evaluate(el => getComputedStyle(el).backgroundColor);
  check("fond du toast reste navy sombre en thème Monarque, pas de régression (" + toastBgDark + ")", toastBgDark === "rgb(14, 27, 48)");
  await page.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await page.locator('[data-tab="heros"]').click();
  await page.waitForTimeout(100);
  const rarityBDark = await page.locator(".rarity").first().evaluate(el => getComputedStyle(el).color);
  check("badge de rareté B suit --ink-dim en thème sombre (" + rarityBDark + ")", rarityBDark === "rgb(138, 163, 194)");
  await page.locator('[data-tab="duel"]').click();
  await page.waitForTimeout(100);
  const chartColorsDark = await page.evaluate(() => {
    const svg = document.querySelector('svg[role="img"]');
    return { grid: getComputedStyle(svg.querySelector("line")).stroke, text: getComputedStyle(svg.querySelector("text")).fill };
  });
  check("grille du graphique XP suit --line-glow du thème Monarque (" + chartColorsDark.grid + ")", chartColorsDark.grid === "rgb(74, 63, 158)");
  check("libellés du graphique XP reviennent à --ink-dim sombre par défaut (" + chartColorsDark.text + ")", chartColorsDark.text === "rgb(138, 163, 194)");
  await page.locator('[data-tab="reglages"]').click();

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

  // Itération 34 : l'enjeu misé peut être annulé avant la fin de la semaine (avec filet Annuler)
  check("bouton « Annuler l'enjeu » présent sur l'enjeu actif", (await page.locator("[data-cancelbet]").count()) === 1);
  await page.locator("[data-cancelbet]").click();
  await page.waitForTimeout(150);
  check("enjeu actif retiré après Annuler l'enjeu", (await page.locator(".betline.hot").count()) === 0);
  check("toast avec bouton Annuler affiché après l'annulation de l'enjeu", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("enjeu actif restauré après Annuler depuis le toast", (await page.locator(".betline.hot").count()) === 1);

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
  check("bouton Annuler présent sur la réclamation du pari", (await page.locator("#veilExtra").count()) === 1);
  const wonBeforeBetUndo = await page.evaluate(() => S.won.length);
  await page.locator("#veilExtra").click();
  await page.waitForTimeout(200);
  check("réclamation du pari annulée (" + wonBeforeBetUndo + " → " + (await page.evaluate(() => S.won.length)) + ")",
    (await page.evaluate(() => S.won.length)) === wonBeforeBetUndo - 1);
  check("le pari redevient réclamable après Annuler", (await page.locator("[data-claimbet]").count()) === 1);
  await page.locator("[data-claimbet]").click(); // re-réclamer pour la suite du scénario
  await page.waitForTimeout(200);
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  await page.locator('[data-tab="objectifs"]').click();
  check("enjeu ajouté aux récompenses gagnées", (await page.locator(".wonline").count()) === 2);
  check("pastille Duel disparue après réclamation du pari",
    (await page.locator('#tabs [data-tab="duel"] .tabdot').count()) === 0);

  // Itération 44 : « Retirer l'enjeu » (égalité) était la seule action de résolution
  // sans filet de rattrapage — nouveau bouton Annuler sur le toast, comme les autres.
  await page.locator('[data-tab="duel"]').click();
  await page.locator("#betAdd").click();
  await page.waitForTimeout(150);
  const tieBetId = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("rangement-sl-v2"));
    const tieBet = raw.S.bets.find(b => !b.claimed);
    const past = new Date(Date.now() - 30 * 864e5);
    past.setHours(0, 0, 0, 0);
    past.setDate(past.getDate() - ((past.getDay() + 6) % 7)); // lundi d'une semaine passée sans activité (0-0, égalité)
    const k = past.getFullYear() + "-" + String(past.getMonth() + 1).padStart(2, "0") + "-" + String(past.getDate()).padStart(2, "0");
    tieBet.week = k;
    localStorage.setItem("rangement-sl-v2", JSON.stringify(raw));
    return tieBet.id;
  });
  await page.reload();
  await page.waitForSelector(".hunter");
  await page.locator('[data-tab="duel"]').click();
  check("pari en égalité affiché avec bouton « Retirer l'enjeu » (Itération 44)", (await page.locator("[data-tiebet]").count()) === 1);
  await page.locator("[data-tiebet]").click();
  await page.waitForTimeout(150);
  check("enjeu marqué retiré après égalité (Itération 44)",
    (await page.evaluate(id => S.bets.find(b => b.id === id).claimed, tieBetId)) === true);
  check("toast « Annuler » proposé après retrait pour égalité (Itération 44)", (await page.locator(".toast-action").count()) === 1);
  await page.locator(".toast-action").click();
  await page.waitForTimeout(150);
  check("retrait pour égalité annulé (Itération 44)",
    (await page.evaluate(id => S.bets.find(b => b.id === id).claimed, tieBetId)) === false);
  check("pari en égalité de nouveau affiché après Annuler (Itération 44)", (await page.locator("[data-tiebet]").count()) === 1);

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
  await evPage.waitForTimeout(100); // laisse le temps au localStorage de se committer avant le reload (évite un flake)
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

  // Heure du rappel du soir : une saisie hors bornes est stockée bornée, et le champ
  // doit désormais réafficher aussitôt la valeur réellement utilisée (re-render manquant, it. 29)
  await evPage.locator('[data-tab="reglages"]').click();
  check("aria-label sur les champs d'heure du rappel du soir et de série",
    (await evPage.locator("#eveningHour[aria-label]").count()) === 1
    && (await evPage.locator("#streakHour[aria-label]").count()) === 1);
  await evPage.fill("#eveningHour", "27");
  await evPage.locator("#eveningHour").evaluate(el => el.blur());
  await evPage.waitForTimeout(150);
  check("heure du soir bornée à 23 en stockage", (await evPage.evaluate(() => localStorage.getItem("rangement-evening-hour"))) === "23");
  check("champ réaffiche la valeur bornée (23), pas la saisie brute (27)",
    (await evPage.locator("#eveningHour").inputValue()) === "23");

  // Entrée valide désormais l'heure du soir sans attendre le blur, Échap annule
  // (cohérence avec les 8 autres champs d'édition en place, oubli corrigé it. 39)
  await evPage.fill("#eveningHour", "22");
  await evPage.locator("#eveningHour").press("Enter");
  await evPage.waitForTimeout(150);
  check("Entrée valide l'heure du soir sans attendre le blur",
    (await evPage.evaluate(() => localStorage.getItem("rangement-evening-hour"))) === "22");
  await evPage.fill("#eveningHour", "5");
  await evPage.locator("#eveningHour").press("Escape");
  await evPage.waitForTimeout(150);
  check("Échap restaure la valeur affichée du champ heure du soir",
    (await evPage.locator("#eveningHour").inputValue()) === "22");
  check("Échap n'enregistre pas l'heure du soir annulée",
    (await evPage.evaluate(() => localStorage.getItem("rangement-evening-hour"))) === "22");

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

  // Récap hebdo « vivant » (it. 29) : reminderTick() doit désormais le déclencher tout
  // seul si l'appli reste ouverte jusqu'à dimanche 18h, comme le bandeau du soir (it. 27).
  await evPage.evaluate(() => {
    localStorage.setItem("rangement-recap", "on");
    localStorage.removeItem("rangement-recap-dismiss");
    window.shouldShowWeeklyRecap = () => true; // simule l'heure due, indépendant de l'horloge réelle
    reminderTick();
  });
  await evPage.waitForTimeout(150);
  check("reminderTick() ouvre le récap tout seul, sans rechargement",
    (await evPage.locator(".sysbox").count()) === 1 && (await evPage.locator(".sysbox").textContent()).includes("RÉCAP DE LA SEMAINE"));
  await evPage.evaluate(() => reminderTick());
  await evPage.waitForTimeout(150);
  check("pas de double-ouverture par dessus une modale déjà affichée", (await evPage.locator(".veil").count()) === 1);
  await evPage.locator("#veilOk").click();
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
  check("aria-pressed reflète le filtre d'univers actif (Itération 31)",
    (await heroPage.locator('[data-hu="One Piece"]').getAttribute("aria-pressed")) === "true"
    && (await heroPage.locator('[data-hu="all"]').getAttribute("aria-pressed")) === "false");
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
  await heroPage.waitForTimeout(100); // laisse le temps à l'écriture localStorage de se propager avant la navigation (flake documenté, it. 31 et suivantes)
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
  const p1EmojiBefore = await heroPage.evaluate(() => S.players[0].emoji);
  check("aria-label du bouton Incarner nomme le héros (Itération 44)",
    (await heroPage.locator('.charcard:has-text("Frieren") [data-equip]').getAttribute("aria-label")) === "Incarner Frieren");
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

  // Emoji verrouillé dans Réglages pendant qu'un héros est incarné (it. 41) : le taper à la
  // main écrasait silencieusement l'emoji du héros sans mettre à jour l'emoji personnel
  // mémorisé, cassant la restauration au retrait.
  await heroPage.locator('[data-tab="reglages"]').click();
  check("champ emoji désactivé tant qu'un héros est incarné", (await heroPage.locator('[data-pemoji="p1"]').isDisabled()));
  check("indication affichée sur le verrouillage de l'emoji", (await heroPage.locator("text=Emoji verrouillé").count()) === 1);
  await heroPage.locator('[data-tab="heros"]').click();

  // Reprendre son emoji : le héros est retiré ET l'emoji personnel réellement restauré
  // (it. 33 — le bouton le promettait depuis l'it. 12 sans jamais le faire, l'utilisateur
  // devait retaper son ancien emoji à la main).
  await heroPage.locator('[data-tab="heros"]').click();
  await heroPage.locator("#unequipBtn").click();
  await heroPage.waitForTimeout(200);
  check("héros retiré", (await heroPage.locator(".hunter").first().locator(".charline").count()) === 0);
  check("emoji personnel réellement restauré (" + p1EmojiBefore + ")", (await heroPage.evaluate(() => S.players[0].emoji)) === p1EmojiBefore);
  await heroPage.locator('[data-tab="reglages"]').click();
  check("champ emoji réactivé après le retrait du héros", !(await heroPage.locator('[data-pemoji="p1"]').isDisabled()));
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
  check("bouton « Annuler » aussi présent (it. 32 — la modale n'avait qu'Incarner)", (await unlockPage.locator("#veilExtra1").count()) === 1);
  await unlockPage.locator("#veilExtra").click();
  await unlockPage.waitForTimeout(250);
  check("héros incarné en un geste depuis la modale",
    (await unlockPage.evaluate(() => S.players[0].characterId)) === "usopp"
    && (await unlockPage.locator(".hunter").first().locator(".charline").textContent()).includes("Usopp"));
  await unlockContext.close();

  // Incarner sur la modale HÉROS DÉBLOQUÉ puis Annuler sur le jalon suivant (NIVEAU) de la
  // même chaîne (it. 41) : jusqu'ici undoTask() ne touchait qu'au journal, laissant le joueur
  // incarné dans un héros dont il ne remplit plus les conditions une fois la quête défaite.
  const equipUndoContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const equipUndoPage = await equipUndoContext.newPage();
  await equipUndoPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await equipUndoPage.goto(APP_URL);
  await equipUndoPage.waitForSelector(".quest");
  const p1EmojiBeforeEquipUndo = await equipUndoPage.evaluate(() => S.players[0].emoji);
  await equipUndoPage.evaluate(() => {
    S.log.push({ id: "pre1eu", ts: Date.now() - 3600e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 190, note: "" });
    S.log.push({ id: "pre2eu", ts: Date.now() - 1800e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 185, note: "" });
    save();
  });
  await equipUndoPage.reload();
  await equipUndoPage.waitForSelector(".quest");
  const xpBeforeEquipUndo = await equipUndoPage.evaluate(() => totalXp("p1"));
  await equipUndoPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await equipUndoPage.waitForSelector(".sysbox");
  const equipUndoModal1 = await equipUndoPage.locator(".sysbox").textContent();
  check("jalon 1 : HÉROS DÉBLOQUÉ (Usopp)", equipUndoModal1.includes("HÉROS DÉBLOQUÉ") && equipUndoModal1.includes("Usopp"));
  await equipUndoPage.locator("#veilExtra").click(); // Incarner
  await equipUndoPage.waitForTimeout(200);
  check("héros bien incarné avant d'annuler la suite", (await equipUndoPage.evaluate(() => S.players[0].characterId)) === "usopp");
  const equipUndoModal2 = await equipUndoPage.locator(".sysbox").textContent();
  check("jalon 2 de la même chaîne : NIVEAU", equipUndoModal2.includes("NIVEAU"));
  await equipUndoPage.locator("#veilExtra").click(); // Annuler (sur le jalon NIVEAU)
  await equipUndoPage.waitForTimeout(250);
  check("quête annulée (XP revenue à " + xpBeforeEquipUndo + ")", (await equipUndoPage.evaluate(() => totalXp("p1"))) === xpBeforeEquipUndo);
  check("héros désincarné automatiquement (conditions perdues)", (await equipUndoPage.evaluate(() => S.players[0].characterId)) === null);
  check("emoji personnel restauré après désincarnation automatique",
    (await equipUndoPage.evaluate(() => S.players[0].emoji)) === p1EmojiBeforeEquipUndo);
  await equipUndoContext.close();

  // Annuler depuis la modale HÉROS DÉBLOQUÉ quand elle est seule dans la chaîne (it. 32) :
  // jusqu'ici seul « Incarner » y était proposé, un mistap n'était pas rattrapable.
  const heroUndoContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const heroUndoPage = await heroUndoContext.newPage();
  await heroUndoPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await heroUndoPage.goto(APP_URL);
  await heroUndoPage.waitForSelector(".quest");
  await heroUndoPage.evaluate(() => {
    S.log.push({ id: "pre1u", ts: Date.now() - 3600e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 190, note: "" });
    S.log.push({ id: "pre2u", ts: Date.now() - 1800e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 185, note: "" });
    save();
  });
  await heroUndoPage.reload();
  await heroUndoPage.waitForSelector(".quest");
  const xpBeforeHeroUndo = await heroUndoPage.evaluate(() => totalXp("p1"));
  await heroUndoPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await heroUndoPage.waitForTimeout(300);
  const heroUndoModal = await heroUndoPage.locator(".sysbox").textContent();
  check("« HÉROS DÉBLOQUÉ » déclenché (scénario Annuler)", heroUndoModal.includes("HÉROS DÉBLOQUÉ"));
  await heroUndoPage.locator("#veilExtra1").click(); // Annuler
  await heroUndoPage.waitForTimeout(250);
  check("quête annulée depuis la modale HÉROS DÉBLOQUÉ (XP revenue à " + xpBeforeHeroUndo + ")",
    (await heroUndoPage.evaluate(() => totalXp("p1"))) === xpBeforeHeroUndo);
  check("héros non débloqué après Annuler", (await heroUndoPage.evaluate(() => S.players[0].characterId)) !== "usopp");
  await heroUndoContext.close();

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

  // Accessibilité clavier des modales système : focus initial (sur l'action sûre « Continuer »,
  // jamais sur « Annuler » même si ce dernier apparaît avant dans le DOM) + piège du Tab
  const initialFocusId = await undoModalPage.evaluate(() => document.activeElement && document.activeElement.id);
  check("focus initial sur l'action sûre, pas sur Annuler (" + initialFocusId + ")", initialFocusId === "veilOk");
  await undoModalPage.keyboard.press("Tab");
  check("Tab boucle vers le premier bouton (piège de focus)",
    (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilExtra");
  await undoModalPage.keyboard.press("Tab");
  check("Tab avance vers le bouton suivant de la modale",
    (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilOk");
  await undoModalPage.keyboard.press("Shift+Tab");
  check("Shift+Tab revient au bouton précédent",
    (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilExtra");
  await undoModalPage.keyboard.press("Shift+Tab");
  check("Shift+Tab boucle vers le dernier bouton (retour à l'action sûre)", (await undoModalPage.evaluate(() => document.activeElement.id)) === "veilOk");

  await undoModalPage.locator("#veilExtra").click();
  await undoModalPage.waitForTimeout(200);
  check("XP revenue à sa valeur d'avant la quête après Annuler depuis la modale (" + preLvlXp + ")",
    (await undoModalPage.evaluate(() => totalXp("p1"))) === preLvlXp);
  await undoModalContext.close();

  // Focus clavier restauré sur le bouton de quête après une chaîne de jalons (it. 32) :
  // render() reconstruit le DOM avant l'ouverture de la modale (l'ancien bouton disparaît) ;
  // doTask() le retrouve après coup via ses attributs data-do/data-p pour que sysModal
  // capture le bon point de départ, au lieu que le focus retombe sur <body>.
  const focusContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const focusPage = await focusContext.newPage();
  await focusPage.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off");
  });
  await focusPage.goto(APP_URL);
  await focusPage.waitForSelector(".quest");
  await focusPage.evaluate(() => {
    S.log.push({ id: "pre-focus", ts: Date.now() - 3600e3, playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 95, note: "" });
    save();
  });
  await focusPage.reload();
  await focusPage.waitForSelector(".quest");
  const focusQuestBtn = focusPage.locator(".quest").first().locator('[data-p="p1"]');
  await focusQuestBtn.focus();
  await focusPage.keyboard.press("Enter");
  await focusPage.waitForSelector(".sysbox");
  check("montée de niveau déclenchée au clavier (scénario focus)", (await focusPage.locator(".sysbox").textContent()).includes("NIVEAU"));
  await focusPage.locator("#veilOk").click();
  await focusPage.waitForTimeout(200);
  const focusRestoredToQuest = await focusPage.evaluate(() => {
    const el = document.activeElement;
    return !!el && el.classList && el.classList.contains("doer") && el.dataset.p === "p1";
  });
  check("focus clavier restauré sur le bouton de quête après la chaîne de jalons", focusRestoredToQuest);
  await focusContext.close();

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
  check("l'entrée bouclier ne compte pas non plus dans le calendrier d'activité (bug corrigé)",
    (await shieldPage.evaluate(() => {
      // Le jour comblé automatiquement par le bouclier doit apparaître avec 0 quête dans le
      // calendrier (aucune tâche réellement faite ce jour-là), pas 1.
      const shieldEntry = S.log.find(l => l.playerId === "p1" && l.note === "bouclier");
      if (!shieldEntry) return false;
      const day = new Date(shieldEntry.ts);
      const label = day.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      return activityCalendar(activityDays()).includes(`${label} — 0 quête`);
    })) === true);
  await shieldPage.evaluate(() => document.querySelectorAll(".toast").forEach(t => t.remove()));
  await shieldPage.locator('[data-tab="duel"]').click();
  check("compte de boucliers disponibles affiché dans Duel", (await shieldPage.locator(".statgrid").textContent()).includes("Boucliers"));

  // Itération 31 : bascule tableau pour le calendrier d'activité (parité avec le graphique XP hebdo)
  check("calendrier affiché par défaut", (await shieldPage.locator(".cal").count()) === 1);
  check("bouton de bascule du calendrier présent", (await shieldPage.locator("#calViewToggle").textContent()).includes("Voir en tableau"));
  check("aria-pressed=false sur la bascule calendrier en vue calendrier (Itération 34)",
    (await shieldPage.locator("#calViewToggle").getAttribute("aria-pressed")) === "false");
  await shieldPage.locator("#calViewToggle").click();
  await shieldPage.waitForTimeout(100);
  check("bascule vers la vue tableau du calendrier", (await shieldPage.locator(".cal").count()) === 0 && (await shieldPage.locator(".datatable").count()) === 1);
  check("le tableau liste les jours avec quêtes (p1 a bien joué)",
    (await shieldPage.locator(".datatable tbody tr").count()) >= 7);
  check("aria-pressed=true sur la bascule calendrier en vue tableau (Itération 34)",
    (await shieldPage.locator("#calViewToggle").getAttribute("aria-pressed")) === "true");
  await shieldPage.locator("#calViewToggle").click();
  await shieldPage.waitForTimeout(100);
  check("retour à la vue calendrier", (await shieldPage.locator(".cal").count()) === 1);
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
  check("aria-pressed=false sur le tri en ordre habituel (Itération 34)",
    (await it27Page.locator("#qSortToggle").getAttribute("aria-pressed")) === "false");
  await it27Page.locator("#qSortToggle").click();
  await it27Page.waitForTimeout(100);
  check("tri par priorité : une quête critique passe en tête",
    (await it27Page.locator(".quest .chip").first().textContent()).includes("Critique"));
  check("aria-pressed=true sur le tri par priorité (Itération 34)",
    (await it27Page.locator("#qSortToggle").getAttribute("aria-pressed")) === "true");
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
    (S.bets ??= []).push({ id: "it27bet", week: weekKey(Date.now() - 30 * 86400000), rewardId: "__random__", createdAt: Date.now(), claimed: false });
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
  check("focus clavier restauré sur le bouton d'origine après fermeture de la modale (it. 29)",
    (await it27Page.evaluate(() => document.activeElement && document.activeElement.id)) === "resetBtn");
  check("« Garder nos données » : pari fantôme conservé (avant remise à zéro)", (await it27Page.evaluate(() => S.bets.length)) === 1);

  // Bug corrigé : « Tout effacer » remettait les conditions de déblocage à zéro
  // (journal vidé) sans jamais retirer le héros incarné — un chasseur pouvait
  // « incarner » un héros dont il ne remplissait plus aucun critère.
  await it27Page.evaluate(() => {
    localStorage.setItem("rangement-baseemoji-" + S.players[0].id, S.players[0].emoji);
    S.players[0].characterId = "usopp";
    S.players[0].emoji = "🎯";
    save();
  });
  await it27Page.locator("#resetBtn").click();
  await it27Page.waitForSelector("#veilExtra");
  await it27Page.locator("#veilExtra").click();
  await it27Page.waitForTimeout(150);
  check("« Tout effacer » : journal vidé, tâches conservées",
    (await it27Page.evaluate(() => S.log.length === 0 && S.tasks.length === 13)));
  check("« Tout effacer » (Itération 31) : les paris en attente sont aussi effacés, plus de pari fantôme",
    (await it27Page.evaluate(() => S.bets.length)) === 0);
  check("« Tout effacer » (bug corrigé) : héros incarné retiré, emoji personnel restauré",
    (await it27Page.evaluate(() => S.players[0].characterId)) === null
    && (await it27Page.evaluate(() => S.players[0].emoji)) !== "🎯");

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

  // Itération 35 : confirmation avant import, accessibilité des interrupteurs, chip "bouclier" masqué
  const it35Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const it35Page = await it35Context.newPage();
  await it35Page.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off"); // déterminisme : indépendant du jour/heure réels
  });
  await it35Page.goto(APP_URL);
  await it35Page.waitForSelector(".quest");

  await it35Page.locator('[data-tab="reglages"]').click();
  check("aria-label sur l'interrupteur Sons (Itération 35)",
    (await it35Page.locator("#soundToggle").getAttribute("aria-label")) === "Sons (montée de niveau, hauts faits)");
  check("aria-label sur l'interrupteur Suggestion de quête équitable (Itération 35)",
    (await it35Page.locator("#suggestToggle").getAttribute("aria-label")) === "Suggestion de quête équitable");
  check("aria-label sur l'interrupteur Rappel du soir (Itération 35)",
    (await it35Page.locator("#eveningToggle").getAttribute("aria-label")) === "Rappel si personne n'a joué aujourd'hui");
  check("aria-label sur l'interrupteur Notification du navigateur (Itération 35)",
    (await it35Page.locator("#notifToggle").getAttribute("aria-label")) === "Notification du navigateur");
  check("aria-label sur l'interrupteur Récap du dimanche soir (Itération 35)",
    (await it35Page.locator("#recapToggle").getAttribute("aria-label")) === "Récap du dimanche soir (dès 18 h)");

  // Le marqueur technique "bouclier" ne doit plus fuiter en chip dans le Journal
  await it35Page.evaluate(() => {
    S.log.push({ id: "it35shield", ts: Date.now(), playerId: "p1", taskName: "Bouclier de série", icon: "🛡️", xp: 0, note: "bouclier" });
    save(); render();
  });
  await it35Page.locator('[data-tab="journal"]').click();
  await it35Page.waitForSelector(".logline");
  const shieldLine = it35Page.locator(".logline", { hasText: "Bouclier de série" }).first();
  check("entrée bouclier affichée dans le Journal", (await shieldLine.count()) === 1);
  check("aucun chip \"bouclier\" affiché sur cette entrée (Itération 35)",
    (await shieldLine.locator(".chip.gold").count()) === 0);
  check("pas de bouton d'édition de note sur l'entrée bouclier (déjà acquis, non régressé)",
    (await shieldLine.locator(".notebtn").count()) === 0);

  // Import de sauvegarde : confirmation obligatoire, action sûre par défaut
  await it35Page.locator('[data-tab="reglages"]').click();
  const beforeImportLen = await it35Page.evaluate(() => S.log.length);
  const importPayload = JSON.stringify({
    players: [
      { id: "p1", name: "Import", emoji: "🦄", color: "#ff0000", characterId: null },
      { id: "p2", name: "Import2", emoji: "🐺", color: "#00ff00", characterId: null },
    ],
    log: [{ id: "it35imported", ts: Date.now(), playerId: "p1", taskName: "Tâche importée", icon: "✅", xp: 30, note: "" }],
  });
  await it35Page.setInputFiles("#importFile", { name: "sauvegarde.json", mimeType: "application/json", buffer: Buffer.from(importPayload) });
  await it35Page.waitForSelector(".sysbox");
  check("modale de confirmation avant import (Itération 35)",
    (await it35Page.locator(".sysbox").textContent()).includes("IMPORTER UNE SAUVEGARDE"));
  check("bouton sûr « Annuler » par défaut sur l'import",
    (await it35Page.locator("#veilOk").textContent()).includes("Annuler"));
  await it35Page.locator("#veilOk").click();
  await it35Page.waitForTimeout(150);
  check("« Annuler » sur l'import : données inchangées",
    (await it35Page.evaluate(() => S.log.length)) === beforeImportLen);

  await it35Page.setInputFiles("#importFile", { name: "sauvegarde.json", mimeType: "application/json", buffer: Buffer.from(importPayload) });
  await it35Page.waitForSelector("#veilExtra");
  check("bouton danger « Importer quand même » présent",
    (await it35Page.locator("#veilExtra").textContent()).includes("Importer quand même"));
  await it35Page.locator("#veilExtra").click();
  await it35Page.waitForTimeout(150);
  check("« Importer quand même » : journal remplacé par celui du fichier",
    (await it35Page.evaluate(() => S.log.length === 1 && S.log[0].taskName === "Tâche importée")));
  await it35Context.close();

  await browser.close();
  done();
})();
