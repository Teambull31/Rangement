const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const APP_URL = "file://" + path.resolve(__dirname, "..", "index.html");

async function launch() {
  const executablePath = ["/opt/pw-browsers/chromium", "/opt/google/chrome/chrome"].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  return { browser, page, errors };
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

module.exports = { APP_URL, launch, check, done };
