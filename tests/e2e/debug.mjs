// Débogage : ouvre la page, dépose le corpus, passe à l'étape 2 et affiche les erreurs.
import { chromium } from "playwright";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const err = [];
p.on("pageerror", (e) => err.push(`PAGEERROR ${e.message} | ${String(e.stack ?? "").split(/\r?\n/).slice(0, 6).join(" | ")}`));
p.on("console", (m) => m.type() === "error" && !m.text().startsWith("Estimating") && err.push(`console ${m.text()}`));
await p.goto(pathToFileURL(join(RACINE, process.env.DIST ?? "dist", "index.html")).href);
await p.getByTestId("choisir-dossier").setInputFiles(join(RACINE, "corpus", "Essai-fictif"));
await p.waitForTimeout(4000);
await p.getByRole("button", { name: "Continuer", exact: true }).click();
await p.waitForTimeout(3000);
await p.screenshot({ path: join(ICI, "sortie", "debug.png") });
console.log((await p.innerText("body")).slice(0, 300));
console.log(err.slice(0, 10).join("\n"));
await b.close();
