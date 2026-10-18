/* Test de synchronisation : la couche de données face à un faux backend Supabase. */
const path = require("path");
const { APP_URL, launch, check, done } = require("./helpers");

(async () => {
  const { browser, page, errors } = await launch();

  await page.addInitScript(() => {
    localStorage.setItem("rangement-onboard-v1", "1");
    localStorage.setItem("rangement-recap", "off"); // déterminisme : indépendant du jour/heure réels
  });
  // Le vrai script CDN porte un hash d'intégrité (SRI) : le remplacer par le mock via
  // route.fulfill() ferait échouer la vérification du navigateur et bloquerait le script
  // en silence (contenu substitué = hash différent, par conception de SRI). À la place,
  // on injecte le mock en tant que script de page (aucune vérification d'intégrité ne
  // s'applique à du JS injecté, seulement aux ressources réseau) avant que quoi que ce
  // soit d'autre ne s'exécute, puis on bloque le vrai script CDN pour qu'il n'écrase pas
  // ensuite window.supabase avec le vrai client.
  await page.addInitScript({ path: path.join(__dirname, "mock-supabase.js") });
  await page.route("**/supabase.js", route => route.abort());

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

  // 5. Plus de 1000 lignes : la lecture est paginée (sinon les plus récentes disparaissent)
  await page.evaluate(() => {
    window.__DB.log = Array.from({ length: 1250 }, (_, i) => ({ id: "bulk-" + i, ts: 1e12 + i, player_id: "p1", task_name: "Tâche Sync A", icon: "🧪", xp: 1, note: "" }));
    window.__notify();
  });
  await page.waitForTimeout(800);
  check("1250 entrées de journal toutes chargées", (await page.evaluate(() => S.log.length)) === 1250);

  // 6. Une écriture refusée par le serveur ne bloque pas les suivantes
  await page.evaluate(() => { window.__reject = "rewards"; });
  await page.evaluate(() => {
    queueOp({ table: "rewards", type: "upsert", row: { id: "bad", name: "x", icon: "x" } });
    queueOp({ table: "won", type: "upsert", row: { id: "after-bad", name: "y", icon: "y", ts: 1 } });
  });
  await page.waitForTimeout(500);
  check("action refusée abandonnée, la suivante part", await page.evaluate(() => PENDING.length === 0 && window.__DB.won.some(w => w.id === "after-bad")));
  await page.evaluate(() => { window.__reject = null; });

  // 7. Import = remplacement total : les lignes absentes du fichier disparaissent aussi de la base
  await page.locator('[data-tab="reglages"]').click();
  await page.locator("#importFile").setInputFiles({
    name: "sauvegarde.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ S: { players: [{ id: "p1", name: "A", emoji: "🗡️" }, { id: "p2", name: "B", emoji: "🛡️" }], log: [{ id: "only-one", ts: Date.now(), playerId: "p1", taskName: "Tâche Sync A", icon: "🧪", xp: 5, note: "" }] } })),
  });
  await page.getByText("Importer quand même").click();
  await page.waitForTimeout(600);
  const logIds = await page.evaluate(() => window.__DB.log.map(l => l.id));
  check("après import, la base ne garde que le fichier (" + logIds.length + " ligne)", logIds.length === 1 && logIds[0] === "only-one");

  // 8. Un id piégé inséré en base n'atteint jamais le HTML (base ouverte à tous)
  await page.evaluate(() => {
    window.__DB.tasks.push({ id: 'x" onmouseover="window.__xss=1', name: "Piège", icon: "💣", prio: "critique", created_at: 3 });
    window.__notify();
  });
  await page.waitForTimeout(800);
  check("id piégé rejeté (aucune quête « Piège », aucun attribut injecté)",
    await page.evaluate(() => !S.tasks.some(t => t.name === "Piège") && !document.querySelector("[onmouseover]")));

  // 9. Rythme d'une quête : lu depuis la base, et écrit quand on le règle dans Réglages
  await page.evaluate(() => { window.__DB.tasks.push({ id: "rythme-1", name: "RythmeTest", icon: "⏱️", prio: "normale", created_at: 9, every_days: 7 }); window.__notify(); });
  await page.waitForTimeout(800);
  check("rythme lu depuis la base (every_days → every)", await page.evaluate(() => S.tasks.find(t => t.id === "rythme-1").every === 7));
  await page.locator('[data-tab="reglages"]').click();
  await page.locator('[data-tevery="rythme-1"]').fill("3");
  await page.locator('[data-tevery="rythme-1"]').blur();
  await page.waitForTimeout(600);
  check("rythme écrit en base (every_days = 3)", await page.evaluate(() => window.__DB.tasks.find(t => t.id === "rythme-1").every_days === 3));

  const realErrors = errors.filter(e => !e.includes("ERR_FILE_NOT_FOUND") && !e.includes("ERR_CONNECTION"));
  check("aucune erreur JavaScript", realErrors.length === 0);
  if (realErrors.length) console.error(realErrors);

  await browser.close();
  done();
})();
