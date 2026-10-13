/**
 * Test de bout en bout : la page construite (dist/index.html) est ouverte comme un client
 * l'ouvrirait, le corpus fictif est déposé, le parcours complet est joué, les archives
 * produites sont enregistrées dans tests/e2e/sortie/.
 *
 * Toute requête réseau autre que data:, blob: et le fichier de la page fait échouer le test.
 *
 *   npm run build && npm run corpus && npm run e2e
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(ICI, "sortie");
const CORPUS = join(RACINE, "corpus", "Essai-fictif");
rmSync(SORTIE, { recursive: true, force: true });
mkdirSync(SORTIE, { recursive: true });

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)} s] ${m}`);

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
// Sans sélecteur de dossier natif, EvMasque enregistre par téléchargement : c'est ce chemin qu'on teste.
await contexte.addInitScript(() => {
  delete window.showDirectoryPicker;
});
const page = await contexte.newPage();

const requetes = [];
const erreurs = [];
const surveiller = (r) => {
  const u = r.url();
  if (!/^(data:|blob:|file:)/.test(u)) requetes.push(u);
};
contexte.on("request", surveiller);
page.on("worker", (w) => log(`worker démarré : ${w.url().slice(0, 40)}…`));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(m.text());
});
page.on("pageerror", (e) => erreurs.push(String(e)));

process.on("unhandledRejection", async (err) => {
  console.error("ERREUR :", err?.message ?? err);
  console.error("Erreurs de la page :", erreurs.slice(0, 20));
  try {
    await page.screenshot({ path: join(SORTIE, "erreur.png"), fullPage: true });
  } catch {}
  process.exit(1);
});
const ecran = (nom) => page.screenshot({ path: join(SORTIE, `${nom}.png`), fullPage: true });
const continuer = page.getByRole("button", { name: "Continuer", exact: true });

await page.goto(pathToFileURL(join(RACINE, "dist", "index.html")).href);
log("page ouverte");

// Accueil
await page.getByRole("button", { name: "Commencer", exact: true }).first().waitFor();
await ecran("0-accueil");
await page.getByRole("button", { name: "Commencer", exact: true }).first().click();

// Étape 1
await page.getByTestId("choisir-dossier").setInputFiles(CORPUS);
await page.getByText("Lecture des fichiers").waitFor({ state: "detached", timeout: 120_000 }).catch(() => undefined);
await continuer.waitFor();
await page.waitForFunction(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent === "Continuer");
  return b && !b.disabled;
});
log("fichiers lus");
await ecran("1-fichiers");
await continuer.click();

// Étape 2 : dictionnaire
const champ = page.getByPlaceholder("Nom de client, référence, nom de personne…");
for (const v of ["Dupont", "Exemple Hydraulique", "Musterfirma", "Jean Martin", "Claire Durand", "H. Weber"]) {
  await champ.fill(v);
  await champ.press("Enter");
}
log("termes saisis");
// Attendre la fin de l'OCR, puis accepter les suggestions restantes
// textContent et non innerText : le libellé est mis en majuscules par la feuille de style.
// On lit #racine et non body : le script de la page, placé en fin de body, contient ces libellés.
await page.waitForFunction(() => !document.getElementById("racine").textContent.includes("Lecture des plans scannés"), null, { timeout: 900_000 });
log("OCR terminé");
for (let i = 0; i < 40; i++) {
  const b = page.getByRole("button", { name: "Masquer", exact: true }).first();
  if (!(await b.count())) break;
  await b.click();
}
log("suggestions acceptées");
await ecran("2-masquer");
await continuer.click();

// Étape 3 : cartouches
await page.waitForTimeout(1500);
await ecran("3-cartouches");
await continuer.click();

// Étape 4 : vérification et validation de chaque fichier
await page.waitForTimeout(2000);
await ecran("4-verification");
await page.locator(".liste-fichiers button", { hasText: "FA-20417-B_plan.pdf" }).click();
await page.waitForTimeout(1500);
await ecran("4b-verification-plan");
for (let i = 0; i < 30; i++) {
  const b = page.getByRole("button", { name: "Valider ce fichier" });
  if (!(await b.count())) {
    const reste = await page.locator(".liste-fichiers button:not(:has(.puce.ok))").first();
    if (!(await reste.count())) break;
    await reste.click();
    continue;
  }
  await b.click();
  await page.waitForTimeout(300);
}
log("fichiers validés");
await continuer.click();

// Étape 5 : production et contrôle
await page.getByRole("button", { name: "Produire et contrôler le paquet" }).click();
await page.waitForFunction(
  () => /Enregistrer sur mon poste|bloqué/.test(document.getElementById("racine").textContent) && !document.getElementById("racine").textContent.includes("Production des fichiers ·"),
  null,
  { timeout: 900_000 },
);
log("production terminée");
await ecran("5-controle");

const bloques = await page.locator(".puce.bloquant").count();
const telechargements = [];
page.on("download", (d) => telechargements.push(d));
if (!bloques) {
  await page.getByRole("button", { name: "Enregistrer sur mon poste" }).click();
  await page.getByTestId("mot-de-passe").waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1000);
  for (const d of telechargements) await d.saveAs(join(SORTIE, d.suggestedFilename()));
  await ecran("6-enregistre");
}
const motDePasse = bloques ? null : await page.getByTestId("mot-de-passe").textContent();

// Page « Nos méthodes »
await page.getByRole("button", { name: "Nos méthodes" }).click();
await ecran("7-methodes");
await page.getByRole("button", { name: "Chiffrement", exact: true }).click();
await ecran("8-chiffrement");

// Un plan seul, choisi comme fichier et non comme dossier
const seul = await contexte.newPage();
seul.on("pageerror", (e) => erreurs.push(String(e)));
await seul.goto(pathToFileURL(join(RACINE, "dist", "index.html")).href);
await seul.getByRole("button", { name: "Commencer", exact: true }).first().click();
await seul.getByTestId("choisir-fichiers").setInputFiles(join(CORPUS, "FA-20417-B", "FA-20417-B_plan.pdf"));
await seul.getByText("1 pièce · 1 fichier", { exact: true }).waitFor({ timeout: 60_000 });
await seul.screenshot({ path: join(SORTIE, "9-plan-seul.png"), fullPage: true });
log("plan seul accepté");

writeFileSync(
  join(SORTIE, "resultat.json"),
  JSON.stringify({ motDePasse, bloques, requetes, erreurs, fichiers: telechargements.map((d) => d.suggestedFilename()) }, null, 2),
);
await navigateur.close();

log(`requêtes réseau hors page : ${requetes.length}`);
log(`erreurs console : ${erreurs.length}`);
for (const e of erreurs.slice(0, 10)) console.log("  ·", e.slice(0, 300));
if (requetes.length || bloques) {
  console.error("ÉCHEC", { requetes, bloques });
  process.exit(1);
}
log("parcours complet réussi");
