/**
 * Le dictionnaire : ce que l'utilisateur veut masquer, et les pseudonymes qui remplacent chaque valeur.
 * Les pseudonymes sont déterministes : même dictionnaire, mêmes pseudonymes.
 *
 * Pas de catégorie (client, personne…) : sur des plans lus par OCR, la deviner se trompe trop souvent,
 * et un pseudonyme neutre en dit moins sur la valeur d'origine.
 */
import { compacter } from "./texte";
import type { Piece, Suggestion, Terme } from "./types";

export const LIBELLES_ORIGINES: Record<Terme["origine"], string> = {
  piece: "Référence de pièce",
  saisie: "Ajouté par vous",
  suggestion: "Suggestion acceptée",
};

export function pseudoPiece(index: number): string {
  return `P-${String(index + 1).padStart(3, "0")}`;
}

/** Numérote les pièces dans l'ordre alphabétique de leur clé. */
export function numeroterPieces(cles: string[]): Piece[] {
  return [...new Set(cles)]
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
    .map((cle, i) => ({ cle, pseudo: pseudoPiece(i) }));
}

/** Recalcule tous les pseudonymes. Une valeur identique à une référence de pièce reçoit le pseudonyme de la pièce. */
export function attribuerPseudos(termes: Terme[], pieces: Piece[]): Terme[] {
  const parPiece = new Map(pieces.map((p) => [compacter(p.cle).compact, p.pseudo]));
  let n = 0;
  return termes.map((t) => ({ ...t, pseudo: parPiece.get(compacter(t.valeur).compact) ?? `MASQUE-${String(++n).padStart(3, "0")}` }));
}

let compteurId = 0;
export function nouvelId(prefixe: string): string {
  compteurId += 1;
  return `${prefixe}-${Date.now().toString(36)}-${compteurId}`;
}

export function creerTerme(valeur: string, origine: Terme["origine"]): Terme {
  return { id: nouvelId("t"), valeur: valeur.trim(), actif: true, origine, pseudo: "" };
}

/** Vrai si deux valeurs désignent la même chose une fois normalisées. */
export function memeValeur(a: string, b: string): boolean {
  return compacter(a).compact === compacter(b).compact;
}

/* -------------------------------------------------------------- suggestions */

export interface TexteSource {
  texte: string;
  origine: string;
}

const SUFFIXES_SOCIETE =
  "SASU|SAS|SARL|EURL|SNC|SCOP|SA|S\\.A\\.|GmbH\\s*&\\s*Co\\.?\\s*KG|GmbH|AG|KG|OHG|UG|Ltd\\.?|Inc\\.?|LLC|S\\.p\\.A\\.|SpA|Srl|BV|B\\.V\\.|NV|AB|Oy|Sp\\.\\s?z\\s?o\\.o\\.";

const RE_SOCIETE = new RegExp(
  `((?:[\\p{Lu}][\\p{L}\\p{N}&'.-]*\\s+){0,4}[\\p{Lu}][\\p{L}\\p{N}&'.-]*)\\s+(?:${SUFFIXES_SOCIETE})(?![\\p{L}])`,
  "gu",
);
const RE_LIBELLE_CLIENT =
  /(?:client|kunde|customer|soci[ée]t[ée]|firma|company|auftraggeber|donneur d'ordres?|destinataire)\s*[:：]\s*([^\n;|]{2,60})/giu;
/** Mot-clé insensible à la casse, dans une regex qui doit rester sensible à la casse pour les noms. */
function ci(motif: string): string {
  // Laisse intacts les classes [...] et les échappements \x ; double chaque lettre isolée.
  return motif.replace(/\\.|\[[^\]]*\]|[a-zà-ÿ]/gi, (m) =>
    m.length === 1 && m.toLowerCase() !== m.toUpperCase() ? `[${m.toLowerCase()}${m.toUpperCase()}]` : m,
  );
}
const MOTS_PERSONNE = String.raw`dessin[ée]|drawn|gezeichnet|gez\.|v[ée]rifi[ée]|checked|gepr[üu]ft|approuv[ée]|approved|freigegeben|auteur|author|bearbeiter|r[ée]dacteur|contact|ansprechpartner`;
const RE_LIBELLE_PERSONNE = new RegExp(
  String.raw`(?:${ci(MOTS_PERSONNE)})[ \t]*(?:${ci("par|by|von")})?[ \t]*[:：]?[ \t]*` +
    String.raw`((?:M\.|Mme|Herr|Frau|Mr\.?|Ms\.?)?[ \t]*[\p{Lu}][\p{L}.'-]+(?:[ \t][\p{Lu}][\p{L}.'-]+){0,2})`,
  "gu",
);
const RE_LIBELLE_REFERENCE =
  /(?:n°\s*(?:de\s*)?(?:plan|pi[èe]ce|dessin)|drawing\s*(?:no\.?|n°|number)|part\s*(?:no\.?|number)|zeichnungs?-?nr\.?|teile-?nr\.?|sach-?nr\.?|r[ée]f[ée]rence|reference|r[ée]f\.)\s*[:：]?\s*([A-Z0-9][A-Z0-9._/-]{3,30})/giu;
const RE_EMAIL = /[\p{L}\p{N}._%+-]+@([\p{L}\p{N}-]+)\.[\p{L}\p{N}.-]+/gu;

/** Mots qui ressemblent à un nom propre dans un cartouche mais n'identifient personne. */
const MOTS_GENERIQUES = new Set(
  [
    "plan", "echelle", "matiere", "tolerance", "tolerances", "generale", "generales", "format", "folio",
    "indice", "date", "nom", "visa", "titre", "designation", "piece", "pieces", "ensemble", "masse",
    "traitement", "etat", "surface", "client", "fournisseur", "massstab", "werkstoff", "benennung",
    "zeichnung", "blatt", "datum", "name", "scale", "material", "title", "sheet", "drawing", "part",
    "quantite", "qte", "nc", "na", "none", "sans", "voir", "acier", "inox", "aluminium",
  ].map((m) => compacter(m).compact),
);

function utile(valeur: string): boolean {
  const c = compacter(valeur).compact;
  if (c.length < 3) return false;
  if (MOTS_GENERIQUES.has(c)) return false;
  if (/^\d+$/.test(c) && c.length < 5) return false;
  return true;
}

/** Propose des termes à masquer à partir des textes lus dans les fichiers. */
export function suggerer(textes: TexteSource[], references: string[], existants: string[]): Suggestion[] {
  const table = new Map<string, Suggestion>();
  const deja = new Set(existants.map((e) => compacter(e).compact));
  const ajouter = (valeur: string, raison: string, societe = false) => {
    let v = valeur.replace(/\s+/g, " ").replace(/[\s:;,.-]+$/, "").trim();
    // « FA-20417-B MÉCANIQUE DUPONT SAS » : la référence collée devant la raison sociale n'en fait pas partie.
    if (societe) v = v.replace(/^(?:\S*\d\S*\s+)+/u, "");
    if (!utile(v)) return;
    const cle = compacter(v).compact;
    if (deja.has(cle)) return;
    const s = table.get(cle);
    if (s) s.occurrences++;
    else table.set(cle, { valeur: v, raison, occurrences: 1 });
  };
  for (const { texte } of textes) {
    for (const m of texte.matchAll(RE_SOCIETE)) ajouter(m[0], "Raison sociale", true);
    for (const m of texte.matchAll(RE_LIBELLE_CLIENT)) ajouter(m[1], "Après « client », « Kunde »…", true);
    for (const m of texte.matchAll(RE_LIBELLE_PERSONNE)) ajouter(m[1], "Après « dessiné par », « vérifié »…");
    for (const m of texte.matchAll(RE_LIBELLE_REFERENCE)) ajouter(m[1], "Après « n° de plan », « référence »…");
    for (const m of texte.matchAll(RE_EMAIL)) {
      const domaine = m[1];
      if (!/^(gmail|outlook|hotmail|yahoo|orange|free|wanadoo|gmx|web|t-online|laposte|sfr)$/i.test(domaine))
        ajouter(domaine, "Domaine d'adresse e-mail", true);
    }
  }
  for (const r of references) ajouter(r, "Nom de fichier ou de dossier");
  return [...table.values()].sort((a, b) => b.occurrences - a.occurrences || a.valeur.localeCompare(b.valeur));
}
