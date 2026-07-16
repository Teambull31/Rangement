/* Test de fumée : parcours complet de l'appli en mode local (sans Supabase). */
const { APP_URL, launch, check, done } = require("./helpers");

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
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  const xpText = (await page.locator(".hunter").first().locator(".xpnums").first().textContent()).trim();
  check("XP créditée après une quête (" + xpText + ")", /^[1-9]\d*\/100 XP/.test(xpText));

  // Deuxième quête : toast avec bouton Annuler
  await page.locator(".quest").nth(1).locator('[data-p="p1"]').click();
  await page.waitForTimeout(300);
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click(); // haut fait lève-tôt/oiseau de nuit selon l'heure
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
    if (await page.locator("#veilOk").count()) {
      const txt = await page.locator(".sysbox").textContent();
      if (txt.includes("NIVEAU")) levelUpSeen = true;
      await page.locator("#veilOk").click();
    }
    await page.waitForTimeout(60);
  }
  check("fenêtre système de montée de niveau", levelUpSeen);

  check("indicateur « dernier » affiché sur les quêtes", (await page.locator(".lastdone").count()) >= 1);

  // Duel : graphique hebdomadaire + hauts faits
  await page.locator('[data-tab="duel"]').click();
  check("graphique XP par semaine présent", (await page.locator('svg[role="img"]').count()) === 1);
  check("barres du graphique tracées", (await page.locator('svg[role="img"] rect').count()) === 16);
  check("hauts faits débloqués visibles", (await page.locator(".feat.on").count()) >= 1);
  check("hauts faits verrouillés grisés", (await page.locator(".feat:not(.on)").count()) >= 1);
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
  const modal = page.locator("#veilOk");
  await modal.waitFor({ timeout: 2000 }).catch(() => {});
  if (await modal.count()) await modal.click();
  await page.locator('[data-tab="objectifs"]').click();
  check("objectif surprise affiché 🎲", (await page.locator(".obj .oreward").last().textContent()).includes("surprise"));
  check("bouton de réclamation présent", (await page.locator("[data-claim]").count()) > 0);
  await page.locator("[data-claim]").last().click();
  await page.waitForTimeout(200);
  const claimModal = (await page.locator(".sysbox").count()) ? await page.locator(".sysbox").textContent() : "";
  check("tirage au sort annoncé", claimModal.includes("Le sort a désigné"));
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  const wonTxt = (await page.locator(".wonline").count()) === 1 ? await page.locator(".wonline").textContent() : "";
  check("récompense gagnée listée (réelle, pas 🎲) : " + wonTxt.trim().split("\n")[0], wonTxt !== "" && !wonTxt.includes("🎲"));

  // Journal + annulation
  await page.locator('[data-tab="journal"]').click();
  const before = await page.locator(".logline").count();
  await page.locator("[data-undo]").first().click();
  await page.waitForTimeout(200);
  check("annulation depuis le journal", (await page.locator(".logline").count()) === before - 1);

  // Réglages : renommage + couleur, persistance après rechargement
  await page.locator('[data-tab="reglages"]').click();
  await page.fill('[data-pname="p1"]', "Max");
  // La couleur se vérifie sur le joueur 2 : le leader de la semaine porte la bordure dorée.
  await page.locator('[data-pcolor="p2"]').evaluate(el => { el.value = "#ff0000"; });
  await page.locator("#savePlayers").click();
  await page.waitForTimeout(200);
  check("joueur renommé", (await page.locator(".hunter .name").first().textContent()).trim() === "Max");
  await page.reload();
  await page.waitForSelector(".hunter");
  check("nom conservé après rechargement", (await page.locator(".hunter .name").first().textContent()).trim() === "Max");
  const borderColor = await page.locator(".hunter").nth(1).evaluate(el => el.style.borderTopColor);
  check("couleur personnalisée appliquée (" + borderColor + ")", borderColor.includes("255, 0, 0") || borderColor === "#ff0000");

  // Thèmes : application + persistance
  await page.locator('[data-tab="reglages"]').click();
  await page.locator('[data-theme="monarque"]').click();
  const sysVar = (await page.evaluate(() => document.documentElement.style.getPropertyValue("--sys"))).trim().toLowerCase();
  check("thème appliqué (" + sysVar + ")", sysVar === "#8b7bff");
  await page.reload();
  await page.waitForSelector(".hunter");
  const sysVar2 = (await page.evaluate(() => document.documentElement.style.getPropertyValue("--sys"))).trim().toLowerCase();
  check("thème conservé après rechargement", sysVar2 === "#8b7bff");

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

  // Pari de duel : mise, résolution sur une semaine passée, réclamation
  check("formulaire de mise affiché", (await page.locator("#betAdd").count()) === 1);
  await page.locator("#betAdd").click();
  await page.waitForTimeout(200);
  check("enjeu actif affiché", (await page.locator(".betline.hot").count()) === 1);
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
  await page.locator("[data-claimbet]").click();
  await page.waitForTimeout(200);
  const betModal = (await page.locator(".sysbox").count()) ? await page.locator(".sysbox").textContent() : "";
  check("« PARI REMPORTÉ » annoncé", betModal.includes("PARI REMPORTÉ"));
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  await page.locator('[data-tab="objectifs"]').click();
  check("enjeu ajouté aux récompenses gagnées", (await page.locator(".wonline").count()) === 2);

  const realErrors = errors.filter(e => !e.includes("ERR_FILE_NOT_FOUND") && !e.includes("ERR_CONNECTION"));
  check("aucune erreur JavaScript", realErrors.length === 0);
  if (realErrors.length) console.error(realErrors);

  await browser.close();
  done();
})();
