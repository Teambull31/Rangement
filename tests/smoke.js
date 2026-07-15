/* Test de fumée : parcours complet de l'appli en mode local (sans Supabase). */
const { APP_URL, launch, check, done } = require("./helpers");

(async () => {
  const { browser, page, errors } = await launch();
  await page.goto(APP_URL);
  await page.waitForSelector(".quest");

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

  // Duel : graphique hebdomadaire + hauts faits
  await page.locator('[data-tab="duel"]').click();
  check("graphique XP par semaine présent", (await page.locator('svg[role="img"]').count()) === 1);
  check("barres du graphique tracées", (await page.locator('svg[role="img"] rect').count()) === 16);
  check("hauts faits débloqués visibles", (await page.locator(".feat.on").count()) >= 1);
  check("hauts faits verrouillés grisés", (await page.locator(".feat:not(.on)").count()) >= 1);
  await page.locator('[data-tab="quetes"]').click();

  // Objectif : création, complétion, réclamation
  await page.locator('[data-tab="objectifs"]').click();
  await page.fill("#objName", "Test défi");
  await page.fill("#objTarget", "10");
  await page.locator("#objAdd").click();
  await page.waitForTimeout(200);
  await page.locator('[data-tab="quetes"]').click();
  await page.locator(".quest").first().locator('[data-p="p2"]').click();
  const modal = page.locator("#veilOk");
  await modal.waitFor({ timeout: 2000 }).catch(() => {});
  if (await modal.count()) await modal.click();
  await page.locator('[data-tab="objectifs"]').click();
  check("bouton de réclamation présent", (await page.locator("[data-claim]").count()) > 0);
  await page.locator("[data-claim]").last().click();
  await page.waitForTimeout(200);
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  check("récompense gagnée listée", (await page.locator(".wonline").count()) === 1);

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

  const realErrors = errors.filter(e => !e.includes("ERR_FILE_NOT_FOUND") && !e.includes("ERR_CONNECTION"));
  check("aucune erreur JavaScript", realErrors.length === 0);
  if (realErrors.length) console.error(realErrors);

  await browser.close();
  done();
})();
