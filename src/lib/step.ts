/**
 * Anonymisation des fichiers STEP (ISO 10303-21).
 *
 * Principe : on ne touche qu'aux chaînes de caractères et aux commentaires. Tout le reste
 * (entités, références, nombres, énumérations), c'est-à-dire la géométrie, est recopié à
 * l'identique, et le contrôle d'intégrité le vérifie.
 */
import { remplacerDansTexte, contientEncore, type Remplacement, type TermeCherche } from "./texte";
import type { Motif } from "./types";

type Part = { type: "code" | "chaine" | "commentaire"; valeur: string };

/** Découpe un fichier STEP en code, chaînes (avec leurs apostrophes) et commentaires. */
export function decouper(texte: string): Part[] {
  const parts: Part[] = [];
  let i = 0;
  let debutCode = 0;
  const pousserCode = (fin: number) => {
    if (fin > debutCode) parts.push({ type: "code", valeur: texte.slice(debutCode, fin) });
  };
  while (i < texte.length) {
    const c = texte[i];
    if (c === "'") {
      pousserCode(i);
      let j = i + 1;
      while (j < texte.length) {
        if (texte[j] === "'") {
          if (texte[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      parts.push({ type: "chaine", valeur: texte.slice(i, j + 1) });
      i = j + 1;
      debutCode = i;
    } else if (c === "/" && texte[i + 1] === "*") {
      pousserCode(i);
      const fin = texte.indexOf("*/", i + 2);
      const j = fin === -1 ? texte.length : fin + 2;
      parts.push({ type: "commentaire", valeur: texte.slice(i, j) });
      i = j;
      debutCode = i;
    } else i++;
  }
  pousserCode(texte.length);
  return parts;
}

/** Décode une chaîne STEP (sans les apostrophes) en texte lisible. */
export function decoderChaine(brut: string): string {
  return brut
    .replace(/''/g, "'")
    .replace(/\\X2\\((?:[0-9A-Fa-f]{4})+)\\X0\\/g, (_, hex: string) =>
      hex.match(/.{4}/g)!.map((h) => String.fromCharCode(parseInt(h, 16))).join(""),
    )
    .replace(/\\X4\\((?:[0-9A-Fa-f]{8})+)\\X0\\/g, (_, hex: string) =>
      hex.match(/.{8}/g)!.map((h) => String.fromCodePoint(parseInt(h, 16))).join(""),
    )
    .replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\S\\(.)/g, (_, c: string) => String.fromCharCode(c.charCodeAt(0) + 128))
    .replace(/\\P[A-I]\\/g, "")
    .replace(/\\\\/g, "\\");
}

/** Encode un texte en chaîne STEP (sans les apostrophes). */
export function encoderChaine(texte: string): string {
  let out = "";
  for (const c of texte) {
    const code = c.codePointAt(0)!;
    if (c === "'") out += "''";
    else if (c === "\\") out += "\\\\";
    else if (code >= 32 && code < 127) out += c;
    else if (code <= 0xffff) out += `\\X2\\${code.toString(16).toUpperCase().padStart(4, "0")}\\X0\\`;
    else out += `\\X4\\${code.toString(16).toUpperCase().padStart(8, "0")}\\X0\\`;
  }
  return out;
}

/** Entités qui ne portent que de l'identité : toutes leurs chaînes sont vidées. */
const ENTITES_VIDEES = new Set([
  "PERSON",
  "ORGANIZATION",
  "ADDRESS",
  "PERSONAL_ADDRESS",
  "ORGANIZATIONAL_ADDRESS",
  "APPROVAL",
  "SECURITY_CLASSIFICATION",
  "DOCUMENT",
  "DOCUMENT_FILE",
  "PRODUCT_DEFINITION_FORMATION",
  "PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE",
  "NEXT_ASSEMBLY_USAGE_OCCURRENCE",
  "APPLIED_PERSON_AND_ORGANIZATION_ASSIGNMENT",
  "CC_DESIGN_PERSON_AND_ORGANIZATION_ASSIGNMENT",
]);

/** Valeurs techniques à conserver telles quelles dans PRODUCT_DEFINITION. */
const MOTS_TECHNIQUES = new Set(["", "design", "part definition", "none", "detailed design", "part", "assembly"]);

const RE_CHEMIN = /(?:[A-Za-z]:\\|\\\\|\/)[^'"]*|[^'"\s]+\.(?:sldprt|sldasm|slddrw|prt|asm|catpart|catproduct|ipt|iam|par|psm|stp|step|igs|iges|x_t|x_b|dwg|dxf)\b/i;

export interface ResultatStep {
  texte: string;
  remplacements: Remplacement[];
  chainesModifiees: number;
  commentairesRetires: number;
}

export interface IndicesStep {
  produits: string[];
  organisations: string[];
  personnes: string[];
  textes: string[];
}

interface Contexte {
  section: "avant" | "header" | "data" | "apres";
  entite: string;
  indice: number;
}

function avancer(ctx: Contexte, code: string): void {
  for (const m of code.matchAll(/\b(HEADER|DATA|ENDSEC)\s*;|([A-Z_][A-Z0-9_]*)\s*\(|;/g)) {
    if (m[1] === "HEADER") ctx.section = "header";
    else if (m[1] === "DATA") ctx.section = "data";
    else if (m[1] === "ENDSEC") ctx.section = ctx.section === "header" ? "avant" : "apres";
    else if (m[2]) {
      // Le premier identifiant suivi d'une parenthèse dans une instruction est le nom de l'entité.
      if (ctx.indice === -1) {
        ctx.entite = m[2];
        ctx.indice = 0;
      }
    } else if (m[0] === ";") {
      ctx.entite = "";
      ctx.indice = -1;
    }
  }
}

/** Parcourt les chaînes avec leur contexte (section, entité, rang de la chaîne dans l'instruction). */
function parcourir(parts: Part[], f: (p: Part, ctx: Contexte) => void): void {
  const ctx: Contexte = { section: "avant", entite: "", indice: -1 };
  for (const p of parts) {
    if (p.type === "code") avancer(ctx, p.valeur);
    else if (p.type === "chaine") {
      f(p, ctx);
      if (ctx.indice >= 0) ctx.indice++;
    }
  }
}

/** Ce que le fichier révèle, pour alimenter les suggestions du dictionnaire. */
export function indicesStep(texte: string): IndicesStep {
  const out: IndicesStep = { produits: [], organisations: [], personnes: [], textes: [] };
  parcourir(decouper(texte), (p, ctx) => {
    const v = decoderChaine(p.valeur.slice(1, -1)).trim();
    if (!v) return;
    out.textes.push(v);
    if (ctx.entite === "PRODUCT" && ctx.indice <= 1) out.produits.push(v);
    else if (ctx.entite === "ORGANIZATION") out.organisations.push(v);
    else if (ctx.entite === "PERSON") out.personnes.push(v);
    else if (ctx.entite === "FILE_NAME" && ctx.indice === 3) out.organisations.push(v);
    else if (ctx.entite === "FILE_NAME" && ctx.indice === 2) out.personnes.push(v);
  });
  return out;
}

/**
 * Anonymise un fichier STEP.
 * @param pseudo   pseudonyme de la pièce (ex. P-001), qui remplace le nom du produit
 * @param nomSortie nom du fichier produit (écrit dans l'en-tête)
 */
export function anonymiserStep(
  texte: string,
  termes: TermeCherche[],
  motifs: Motif[],
  pseudo: string,
  nomSortie: string,
): ResultatStep {
  const parts = decouper(texte);
  const remplacements: Remplacement[] = [];
  let chainesModifiees = 0;
  let commentairesRetires = 0;

  parcourir(parts, (p, ctx) => {
    const brut = p.valeur.slice(1, -1);
    const lisible = decoderChaine(brut);
    let nouveau: string | null = null;

    if (ctx.section === "header") {
      if (ctx.entite === "FILE_NAME") {
        nouveau = ctx.indice === 0 ? nomSortie : ctx.indice === 1 ? "2000-01-01T00:00:00" : "";
      } else if (ctx.entite === "FILE_DESCRIPTION") {
        nouveau = /^\d;\d$/.test(lisible) ? lisible : "Fichier anonymise par EvMasque";
      } else if (ctx.entite === "FILE_SCHEMA") {
        nouveau = lisible;
      }
    } else if (ctx.section === "data") {
      if (ENTITES_VIDEES.has(ctx.entite)) nouveau = "";
      else if (ctx.entite === "PRODUCT") nouveau = ctx.indice <= 1 ? pseudo : "";
      else if (ctx.entite === "PRODUCT_DEFINITION")
        nouveau = MOTS_TECHNIQUES.has(lisible.trim().toLowerCase()) ? lisible : "";
      else if (RE_CHEMIN.test(lisible)) nouveau = "";
    }

    if (nouveau === null) {
      const r = remplacerDansTexte(lisible, termes, motifs);
      if (r.remplacements.length) {
        nouveau = r.texte;
        remplacements.push(...r.remplacements);
      }
    } else if (nouveau !== lisible && lisible.trim()) {
      remplacements.push({ de: lisible, vers: nouveau || "(vide)" });
    }

    if (nouveau !== null && nouveau !== lisible) {
      p.valeur = `'${encoderChaine(nouveau)}'`;
      chainesModifiees++;
    }
  });

  let sortie = "";
  for (const p of parts) {
    if (p.type === "commentaire") {
      commentairesRetires++;
      continue;
    }
    sortie += p.valeur;
  }
  return { texte: sortie, remplacements, chainesModifiees, commentairesRetires };
}

/** Empreinte du « code » d'un fichier STEP : tout sauf chaînes et commentaires, blancs normalisés. */
function empreinteCode(texte: string): { code: string; chaines: number } {
  let code = "";
  let chaines = 0;
  for (const p of decouper(texte)) {
    if (p.type === "code") code += p.valeur;
    else if (p.type === "chaine") {
      code += "'?'";
      chaines++;
    }
  }
  return { code: code.replace(/\s+/g, ""), chaines };
}

export interface IntegriteStep {
  ok: boolean;
  entites: number;
  message: string;
}

/** Vérifie que la géométrie (entités, références, nombres) est strictement identique. */
export function verifierIntegrite(original: string, sortie: string): IntegriteStep {
  const a = empreinteCode(original);
  const b = empreinteCode(sortie);
  const entites = (original.match(/#\d+\s*=/g) ?? []).length;
  if (a.code === b.code && a.chaines === b.chaines)
    return { ok: true, entites, message: `${entites} entités et toutes les valeurs numériques identiques à l'original` };
  return { ok: false, entites, message: "La structure du fichier diffère de l'original : fichier bloqué" };
}

/** Double contrôle : chaînes du fichier produit qui contiennent encore un terme ou un motif. */
export function fuitesStep(sortie: string, termes: TermeCherche[], motifs: Motif[]): string[] {
  const fuites: string[] = [];
  for (const p of decouper(sortie)) {
    if (p.type !== "chaine") continue;
    fuites.push(...contientEncore(decoderChaine(p.valeur.slice(1, -1)), termes, motifs));
  }
  return fuites;
}
