/**
 * Anonymisation des tableurs (Excel, CSV, ODS).
 *
 * Même principe que pour les plans : on ne modifie pas le classeur, on en **reconstruit un neuf**
 * qui ne contient que des valeurs. Propriétés du document, commentaires, images, liens externes,
 * formules et mises en forme ne sont pas recopiés.
 */
import * as XLSX from "xlsx";
import { remplacerDansTexte, contientEncore, type Remplacement, type TermeCherche } from "./texte";
import type { Motif } from "./types";

export type Cellule = string | number | boolean | Date | null;

export interface FeuilleAnalysee {
  nom: string;
  masquee: boolean;
  lignes: Cellule[][];
  ligneEntete: number;
  entetes: string[];
  colonnesPrix: number[];
}

export interface TableurAnalyse {
  feuilles: FeuilleAnalysee[];
  separateurCsv: string | null;
  textes: string[];
  valeursClient: string[];
}

const RE_PRIX =
  /(?:^|[^\p{L}])(prix|tarifs?|taux|marges?|coef(?:ficient)?s?|montants?|total|remises?|p\.?\s?u\.?|eur(?:os?)?|co[uû]ts?|valeurs?|price|cost|rate|margin|preis|kosten|stundensatz|rabatt|betrag|summe|ht|ttc)(?:$|[^\p{L}])|€/iu;
const RE_TEMPS = /(?:^|[^\p{L}])(temps|time|zeit|dur[ée]e|cadence|minutes?|heures?|secondes?|stunden?|qt[ée]|quantit[ée]s?|menge)(?:$|[^\p{L}])/iu;
const RE_COLONNE_CLIENT = /client|kunde|customer|soci[ée]t[ée]|donneur|auftraggeber|destinataire|firma/i;

/** Une colonne de prix, de taux ou de marge (« Temps total » n'en est pas une). */
export function estColonnePrix(entete: string): boolean {
  if (!entete) return false;
  if (/€|taux\s+horaire|co[uû]t\s+horaire|stundensatz/i.test(entete)) return true;
  return RE_PRIX.test(entete) && !RE_TEMPS.test(entete);
}

/** La ligne d'en-tête : parmi les 15 premières, celle qui porte le plus de libellés. */
function trouverLigneEntete(lignes: Cellule[][]): number {
  let meilleure = 0;
  let max = 1;
  for (let i = 0; i < Math.min(lignes.length, 15); i++) {
    const r = lignes[i] ?? [];
    const textes = r.filter((c) => typeof c === "string" && c.trim()).length;
    const nombres = r.filter((c) => typeof c === "number").length;
    if (textes > max && textes > nombres) {
      meilleure = i;
      max = textes;
    }
  }
  return meilleure;
}

function detecterSeparateur(texte: string): string {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  const nb = (c: string) => premiere.split(c).length - 1;
  return [";", "\t", ","].sort((a, b) => nb(b) - nb(a))[0];
}

export function analyserTableur(donnees: ArrayBuffer, extension: string): TableurAnalyse {
  let separateurCsv: string | null = null;
  let wb: XLSX.WorkBook;
  if (extension === "csv") {
    const texte = new TextDecoder("utf-8").decode(donnees);
    separateurCsv = detecterSeparateur(texte);
    wb = XLSX.read(texte, { type: "string", FS: separateurCsv, cellDates: true, raw: false });
  } else {
    wb = XLSX.read(new Uint8Array(donnees), { type: "array", cellDates: true, cellStyles: false, bookVBA: false });
  }
  const feuilles: FeuilleAnalysee[] = wb.SheetNames.map((nom, i) => {
    const ws = wb.Sheets[nom];
    const lignes = XLSX.utils.sheet_to_json<Cellule[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const ligneEntete = trouverLigneEntete(lignes);
    const entetes = (lignes[ligneEntete] ?? []).map((c) => (c === null ? "" : String(c)));
    const colonnesPrix = entetes.map((e, j) => (estColonnePrix(e) ? j : -1)).filter((j) => j >= 0);
    const masquee = !!wb.Workbook?.Sheets?.[i]?.Hidden;
    return { nom, masquee, lignes, ligneEntete, entetes, colonnesPrix };
  });

  const textes: string[] = [];
  const valeursClient: string[] = [];
  for (const f of feuilles) {
    textes.push(f.nom);
    const colsClient = f.entetes.map((e, j) => (RE_COLONNE_CLIENT.test(e) ? j : -1)).filter((j) => j >= 0);
    f.lignes.forEach((r, i) => {
      r.forEach((c, j) => {
        if (typeof c === "string" && c.trim()) {
          if (textes.length < 5000) textes.push(c);
          if (i > f.ligneEntete && colsClient.includes(j)) valeursClient.push(c.trim());
        }
      });
      // Ligne « Client : X » au-dessus de l'en-tête du tableau (jamais l'en-tête lui-même)
      if (i < f.ligneEntete) {
        for (let j = 0; j + 1 < r.length; j++)
          if (typeof r[j] === "string" && RE_COLONNE_CLIENT.test(r[j] as string) && typeof r[j + 1] === "string")
            valeursClient.push((r[j + 1] as string).trim());
      }
    });
  }
  return { feuilles, separateurCsv, textes, valeursClient };
}

export interface ChoixTableur {
  inclureMasquees: boolean;
  /** Colonnes de prix à retirer, par nom de feuille. */
  colonnesRetirees: Record<string, number[]>;
}

export interface ResultatTableur {
  octets: Uint8Array;
  remplacements: Remplacement[];
  feuillesRetirees: string[];
  colonnesRetirees: string[];
  cellulesModifiees: number;
}

function nomFeuilleValide(nom: string, pris: Set<string>): string {
  let n = nom.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Feuille";
  let k = 2;
  while (pris.has(n.toLowerCase())) n = `${n.slice(0, 28)} ${k++}`;
  pris.add(n.toLowerCase());
  return n;
}

export function anonymiserTableur(
  analyse: TableurAnalyse,
  extension: string,
  termes: TermeCherche[],
  motifs: Motif[],
  choix: ChoixTableur,
): ResultatTableur {
  const remplacements: Remplacement[] = [];
  const feuillesRetirees: string[] = [];
  const colonnesRetirees: string[] = [];
  let cellulesModifiees = 0;

  const wb = XLSX.utils.book_new();
  wb.Props = { Title: "", Subject: "", Author: "EvMasque", Company: "", Manager: "", Comments: "", Keywords: "", LastAuthor: "EvMasque", Category: "" };
  const pris = new Set<string>();

  const anonymiserTexte = (s: string): string => {
    const r = remplacerDansTexte(s, termes, motifs);
    if (r.remplacements.length) {
      remplacements.push(...r.remplacements);
      cellulesModifiees++;
    }
    return r.texte;
  };

  for (const f of analyse.feuilles) {
    if (f.masquee && !choix.inclureMasquees) {
      feuillesRetirees.push(anonymiserTexte(f.nom));
      continue;
    }
    const retirer = new Set(choix.colonnesRetirees[f.nom] ?? []);
    for (const j of retirer) colonnesRetirees.push(`${anonymiserTexte(f.nom)} · ${anonymiserTexte(f.entetes[j] || `colonne ${j + 1}`)}`);
    const lignes = f.lignes.map((r) =>
      r
        .map((c, j) => ({ c, j }))
        .filter(({ j }) => !retirer.has(j))
        .map(({ c }) => (typeof c === "string" ? anonymiserTexte(c) : c)),
    );
    const ws = XLSX.utils.aoa_to_sheet(lignes, { cellDates: true });
    XLSX.utils.book_append_sheet(wb, ws, nomFeuilleValide(anonymiserTexte(f.nom), pris));
  }
  if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["(aucune feuille conservée)"]]), "Feuille");

  let octets: Uint8Array;
  if (extension === "csv") {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: analyse.separateurCsv ?? ";" });
    octets = new TextEncoder().encode("﻿" + csv);
  } else {
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }) as ArrayBuffer;
    octets = new Uint8Array(out);
  }
  return { octets, remplacements, feuillesRetirees, colonnesRetirees, cellulesModifiees };
}

/** Double contrôle : relit le tableur produit et cherche ce qui devait disparaître. */
export function fuitesTableur(octets: Uint8Array, extension: string, termes: TermeCherche[], motifs: Motif[]): string[] {
  const analyse = analyserTableur(octets.slice().buffer, extension);
  const fuites: string[] = [];
  for (const f of analyse.feuilles) {
    fuites.push(...contientEncore(f.nom, termes, motifs));
    for (const r of f.lignes) for (const c of r) if (typeof c === "string") fuites.push(...contientEncore(c, termes, motifs));
  }
  return fuites;
}
