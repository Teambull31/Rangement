/* Test de synchronisation : la couche de données face à un faux backend Supabase. */
const fs = require("fs");
const path = require("path");
const { APP_URL, launch, check, done } = require("./helpers");

(async () => {
  const { browser, page, errors } = await launch();

  await page.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off"); // déterminisme : indépendant du jour/heure réels
  });
  await page.route("**/supabase.js", route =>
    route.fulfill({
      contentType: "application/javascript",
      body: fs.readFileSync(path.join(__dirname, "mock-supabase.js"), "utf8"),
    }));

  await page.goto(APP_URL);
  await page.waitForSelector(".quest");
  await page.waitForTimeout(600); // laisse loadRemote() aboutir

  // 1. L'état vient de la base distante, pas des valeurs par défaut locales
  const name1 = (await page.locator(".hunter .name").first().textContent()).trim();
  check("état chargé depuis la base (joueur distant : " + name1 + ")", name1 === "AliceSync");
  check("quêtes distantes affichées", (await page.locator(".quest").count()) === 2);
  check("badge « synchronisé »", (await page.locator("#sync").textContent()).includes("synchronisé"));

  // 2. Compléter une quête écrit dans la base
  await page.locator(".quest").first().locator('[data-p="p1"]').click();
  await page.waitForTimeout(600);
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click(); // haut fait « Première quête »
  const dbLog = await page.evaluate(() => window.__DB.log);
  check("action envoyée à la base (xp=" + (dbLog[0] && dbLog[0].xp) + ")", dbLog.length === 1 && dbLog[0].player_id === "p1");

  // 3. Action de « l'autre téléphone » : insertion en base + événement realtime
  await page.evaluate(() => {
    window.__DB.log.push({ id: "autre-tel", ts: Date.now(), player_id: "p2", task_name: "Tâche Sync B", icon: "🧫", xp: 35, note: "" });
    window.__notify();
  });
  await page.waitForTimeout(800);
  const p2week = (await page.locator(".hunter").nth(1).locator(".xpnums").last().textContent()).trim();
  check("mise à jour temps réel de l'autre joueur (" + p2week + ")", p2week.includes("35"));

  // 4. Annulation propagée à la base
  await page.locator('[data-tab="journal"]').click();
  await page.locator("[data-undo]").first().click();
  await page.waitForTimeout(600);
  const ids = await page.evaluate(() => window.__DB.log.map(l => l.id));
  check("suppression propagée (reste : " + ids.join(",") + ")", ids.length === 1 && ids[0] !== "autre-tel");

  const realErrors = errors.filter(e => !e.includes("ERR_FILE_NOT_FOUND") && !e.includes("ERR_CONNECTION"));
  check("aucune erreur JavaScript", realErrors.length === 0);
  if (realErrors.length) console.error(realErrors);

  await browser.close();
  done();
})();
