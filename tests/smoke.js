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
  const suggestedCount = await page.locator(".quest.suggested").count();
  const bonusEqualsOverdue = await page.evaluate(() => bonusTaskId() === overdueTaskId());
  check("suggestion de tâche équitable affichée", bonusEqualsOverdue ? suggestedCount === 0 : suggestedCount === 1);

  // Duel : graphique hebdomadaire + hauts faits
  await page.locator('[data-tab="duel"]').click();
  check("graphique XP par semaine présent", (await page.locator('svg[role="img"]').count()) === 1);
  check("barres du graphique tracées", (await page.locator('svg[role="img"] rect').count()) === 16);
  check("hauts faits débloqués visibles", (await page.locator(".feat.on").count()) >= 1);
  check("hauts faits verrouillés grisés", (await page.locator(".feat:not(.on)").count()) >= 1);
  check("répartition des tâches affichée", (await page.locator(".splitline").count()) >= 1);

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
  const modal = page.locator("#veilOk");
  await modal.waitFor({ timeout: 2000 }).catch(() => {});
  if (await modal.count()) await modal.click();
  await page.locator('[data-tab="objectifs"]').click();
  check("objectif surprise affiché 🎲", (await page.locator(".obj .oreward").last().textContent()).includes("surprise"));
  check("bouton de réclamation présent", (await page.locator("[data-claim]").count()) > 0);
  await page.locator("[data-claim]").last().click();
  check("confettis affichés à la réclamation d'une récompense", (await page.locator("#confetti").count()) === 1);
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

  // Recherche et filtre du Journal (une entrée fraîche pour Chasseuse : l'undo précédent a pu vider les siennes)
  await page.locator('[data-tab="quetes"]').click();
  await page.locator(".quest").nth(2).locator('[data-p="p2"]').click();
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
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
  await page.locator("[data-claimbet]").click();
  check("confettis affichés à la réclamation d'un pari", (await page.locator("#confetti").count()) === 1);
  await page.waitForTimeout(200);
  const betModal = (await page.locator(".sysbox").count()) ? await page.locator(".sysbox").textContent() : "";
  check("« PARI REMPORTÉ » annoncé", betModal.includes("PARI REMPORTÉ"));
  if (await page.locator("#veilOk").count()) await page.locator("#veilOk").click();
  await page.locator('[data-tab="objectifs"]').click();
  check("enjeu ajouté aux récompenses gagnées", (await page.locator(".wonline").count()) === 2);

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
  check("Luffy est le plus dur à obtenir (" + luffyCond.trim() + ")", luffyCond.includes("28") && luffyCond.includes("100") && luffyCond.includes("trophée"));
  check("progression visible sur les héros verrouillés (" + luffyCond.trim() + ")", luffyCond.includes("1/28") && luffyCond.includes("0/100"));
  check("hauts faits héros verrouillés sur un compte frais",
    await heroPage.evaluate(() => unlockedFeats("p1").every(f => !["hero1", "hero5", "heroH", "soul"].includes(f.id))));

  // Grosse progression injectée : 300 quêtes réparties sur 15 jours (niveau ~29, série 15, 2 trophées passés)
  await heroPage.evaluate(() => {
    for (let i = 0; i < 300; i++) {
      const d = new Date(); d.setDate(d.getDate() - (i % 15)); d.setHours(10, 0, 0, 0);
      S.log.push({ id: "grind" + i, ts: d.getTime() + (i * 1000), playerId: "p1", taskName: "Vitres", icon: "🪟", xp: 50, note: "" });
    }
    save();
  });
  await heroPage.reload();
  await heroPage.waitForSelector(".quest");
  await heroPage.locator('[data-tab="heros"]').click();
  const unlockedCount = await heroPage.evaluate(() => unlockedCharIds("p1").length);
  check("gros grind -> collection complète débloquée (" + unlockedCount + "/" + totalChars + ")", unlockedCount === totalChars);
  check("hauts faits héros débloqués par le grind",
    await heroPage.evaluate(() => { const ids = new Set(unlockedFeats("p1").map(f => f.id)); return ids.has("hero1") && ids.has("hero5") && ids.has("heroH"); }));

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
  await unlockPage.locator(".quest").first().locator('[data-p="p1"]').click();
  await unlockPage.waitForTimeout(300);
  const unlockModal = (await unlockPage.locator(".sysbox").count()) ? await unlockPage.locator(".sysbox").textContent() : "";
  check("« HÉROS DÉBLOQUÉ » prioritaire sur la montée de niveau (" + unlockModal.replace(/\s+/g, " ").slice(0, 60) + ")", unlockModal.includes("HÉROS DÉBLOQUÉ") && unlockModal.includes("Usopp"));
  await unlockContext.close();

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
  if (await rmPage.locator("#veilOk").count()) await rmPage.locator("#veilOk").click();
  await rmPage.locator('[data-tab="objectifs"]').click();
  await rmPage.locator("[data-claim]").last().click();
  check("aucun confetti créé avec le mouvement réduit", (await rmPage.locator("#confetti").count()) === 0);
  await rmContext.close();

  await browser.close();
  done();
})();
