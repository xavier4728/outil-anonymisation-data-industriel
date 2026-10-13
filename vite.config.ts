import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Verrou réseau : en production, la page interdit toute connexion sortante.
 * `connect-src` n'autorise que `blob:` et `data:` (données déjà présentes dans la page).
 * Ce verrou est appliqué par le navigateur lui-même, pas par notre code.
 */
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob: 'wasm-unsafe-eval'",
  "worker-src blob:",
  "style-src 'unsafe-inline'",
  "img-src blob: data:",
  "font-src data:",
  "connect-src blob: data:",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

function verrouReseau(): Plugin {
  return {
    name: "evmasque-verrou-reseau",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<!--CSP-->",
        `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      );
    },
  };
}

/** Favicon intégrée à la page : le verrou réseau n'autorise que les images `data:` et `blob:`. */
function iconeEmbarquee(): Plugin {
  return {
    name: "evmasque-icone",
    transformIndexHtml(html) {
      const png = readFileSync("public/favicon-32x32.png").toString("base64");
      return html.replace("<!--FAVICON-->", `<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,${png}" />`);
    },
  };
}

/**
 * Place le script (≈ 14 Mo, intégré à la page) en fin de document, après la présentation.
 * Un script de type module s'exécute de toute façon après la lecture du document : rien ne change pour
 * l'outil, mais les moteurs de recherche, qui ne lisent que le début d'une page, trouvent le texte tout de suite.
 */
function scriptEnFin(): Plugin {
  return {
    name: "evmasque-script-en-fin",
    apply: "build",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const page = bundle["index.html"];
        if (!page || page.type !== "asset") return;
        const html = String(page.source);
        const debut = html.indexOf('<script type="module"');
        const fin = html.indexOf("</script>", debut) + "</script>".length;
        const corps = html.lastIndexOf("</body>");
        if (debut < 0 || fin < debut || corps < fin) throw new Error("EvMasque : script ou fin de page introuvable dans index.html");
        page.source = html.slice(0, debut) + html.slice(fin, corps) + html.slice(debut, fin) + "\n" + html.slice(corps);
      },
    },
  };
}

/**
 * Embarque un fichier binaire (décodeur wasm, langue OCR) dans la page, encodé en base64.
 * Usage : `import donnees from "paquet/fichier.wasm?b64"`.
 */
function embarquer(): Plugin {
  const PREFIXE = "\0evmasque-b64:";
  return {
    name: "evmasque-embarquer",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith("?b64")) return null;
      const r = await this.resolve(source.slice(0, -4), importer, { skipSelf: true });
      return r ? PREFIXE + r.id : null;
    },
    load(id) {
      if (!id.startsWith(PREFIXE)) return null;
      return `export default ${JSON.stringify(readFileSync(id.slice(PREFIXE.length)).toString("base64"))};`;
    },
  };
}

/** Texte des licences des paquets intégrés à la page, tel que leurs licences demandent de le fournir. */
function noticesTiers(paquets: string[]): string {
  const blocs: string[] = [];
  const resume: string[] = [];
  for (const nom of [...paquets].sort()) {
    const dossier = join("node_modules", nom);
    const pkg = JSON.parse(readFileSync(join(dossier, "package.json"), "utf8"));
    const licence = typeof pkg.license === "string" ? pkg.license : (pkg.license?.type ?? "non déclarée");
    const depot = typeof pkg.repository === "string" ? pkg.repository : (pkg.repository?.url ?? pkg.homepage ?? "");
    resume.push(`- ${nom} ${pkg.version} : ${licence}${depot ? ` (${depot.replace(/^git\+/, "")})` : ""}`);
    // Les décodeurs wasm de pdf.js ont leurs propres licences, rangées à côté d'eux.
    const fichiers = [dossier, join(dossier, "wasm")]
      .filter((d) => existsSync(d))
      .flatMap((d) => readdirSync(d).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f)).map((f) => join(d, f)));
    const textes = fichiers.map((f) => `[${f.replace(/\\/g, "/").replace(/^node_modules\//, "")}]\n\n${readFileSync(f, "utf8").replace(/\r\n/g, "\n").trim()}`);
    blocs.push(
      `${"=".repeat(78)}\n${nom} ${pkg.version} (${licence})\n${"=".repeat(78)}\n\n` +
        (textes.length ? textes.join("\n\n") : `Aucun fichier de licence fourni par le paquet. Licence déclarée : ${licence}.`),
    );
  }
  return (
    "EvMasque : composants tiers intégrés à la page\n\n" +
    "EvMasque (licence Apache 2.0, (c) 2026 EVOLIA STRATÉGIE SAS) intègre les bibliothèques libres ci-dessous.\n" +
    "Leurs licences et avis sont reproduits ensuite, comme elles le demandent. Fichier produit à chaque construction.\n\n" +
    resume.join("\n") +
    "\n\n" +
    blocs.join("\n\n") +
    "\n"
  );
}

/** Relève les paquets réellement intégrés à la page, puis publie leurs licences à côté d'elle et dans le dépôt. */
function licencesTiers(): Plugin {
  const paquets = new Set<string>();
  return {
    name: "evmasque-licences-tiers",
    apply: "build",
    buildStart() {
      // Les polices arrivent par des @import de la feuille de style, qui ne passent pas par transform.
      for (const m of readFileSync("src/styles.css", "utf8").matchAll(/@import\s+"((?:@[^/"]+\/)?[^/"]+)\//g)) paquets.add(m[1]);
    },
    transform(_code, id) {
      const chemin = id.replace(/\?.*$/, "").replace(/\\/g, "/");
      const m = [...chemin.matchAll(/node_modules\/((?:@[^/]+\/)?[^/]+)/g)].pop();
      if (m) paquets.add(m[1]);
      return null;
    },
    generateBundle() {
      const texte = noticesTiers([...paquets]);
      this.emitFile({ type: "asset", fileName: "licences-tiers.txt", source: texte });
      writeFileSync("THIRD-PARTY-NOTICES.txt", texte);
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    embarquer(),
    licencesTiers(),
    iconeEmbarquee(),
    react(),
    viteSingleFile({ removeViteModuleLoader: true }),
    verrouReseau(),
    scriptEnFin(),
  ],
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 100_000,
    cssCodeSplit: false,
    sourcemap: false,
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
