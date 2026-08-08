const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const APP_URL = "file://" + path.resolve(__dirname, "..", "index.html");

// Le vrai projet Supabase de production ne doit JAMAIS être joignable depuis les tests
// locaux : sans ce filet, un supabase.js qui charge avec succès (CDN, cache navigateur…)
// connecterait silencieusement les scénarios de test — y compris les remises à zéro et
// imports destructeurs — à la vraie base partagée par les deux téléphones.
// Patché sur browser.newContext() (dont browser.newPage() dépend en interne) pour couvrir
// aussi les nombreux browser.newContext() créés directement par les scénarios isolés de
// smoke.js, sans avoir à modifier chacun de leurs appels.
const SUPABASE_PROJECT_HOST = "vnisnfjfnxrjuxwgwibs.supabase.co";
function guardAgainstRealSupabase(browser) {
  const realNewContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const ctx = await realNewContext(options);
    await ctx.route(`https://${SUPABASE_PROJECT_HOST}/**`, route => route.abort());
    return ctx;
  };
}

async function launch() {
  const executablePath = ["/opt/pw-browsers/chromium", "/opt/google/chrome/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  guardAgainstRealSupabase(browser);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  return { browser, page, errors };
}

// Ferme toutes les modales système enchaînées (plusieurs jalons peuvent tomber sur la
// même quête depuis l'itération 24 : niveau + objectif + haut fait à la suite).
async function closeModals(page, max) {
  for (let i = 0; i < (max || 6); i++) {
    const ok = page.locator("#veilOk");
    if (!(await ok.count())) return;
    await ok.click();
    await page.waitForTimeout(80);
  }
}

let failures = 0;
function check(label, ok) {
  console.log((ok ? "  ✅ " : "  ❌ ") + label);
  if (!ok) failures = 1;
}
function done() {
  if (failures) { console.error("ÉCHEC : au moins une assertion a échoué."); process.exit(1); }
  console.log("Tous les tests passent.");
}

module.exports = { APP_URL, launch, check, done, closeModals };
