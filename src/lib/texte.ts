/**
 * Normalisation et recherche de termes.
 *
 * Un nom de client s'écrit de dix façons sur des plans : « XY Industrie », « XYINDUSTRIE »,
 * « X.Y. Industrie », avec ou sans accent, en majuscules dans un cartouche, coupé par l'OCR.
 * On compare donc des formes « compactes » : minuscules, sans accents, lettres et chiffres seuls.
 */
import type { Motif, Segment, Rect } from "./types";

const REMPLACEMENTS: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d" };

/** Normalise un caractère : minuscule, sans accent. Peut renvoyer plusieurs caractères (ß → ss). */
function normaliserCaractere(c: string): string {
  const bas = c.toLowerCase();
  if (REMPLACEMENTS[bas]) return REMPLACEMENTS[bas];
  return bas.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normaliser(s: string): string {
  let out = "";
  for (const c of s) out += normaliserCaractere(c);
  return out;
}

const ALNUM = /[a-z0-9]/;

export interface Compact {
  compact: string;
  /** Pour chaque caractère compact, l'indice du caractère d'origine. */
  carte: number[];
}

export function compacter(s: string): Compact {
  let compact = "";
  const carte: number[] = [];
  let i = 0;
  for (const c of s) {
    for (const n of normaliserCaractere(c)) {
      if (ALNUM.test(n)) {
        compact += n;
        carte.push(i);
      }
    }
    i += c.length;
  }
  return { compact, carte };
}

export interface Plage {
  debut: number;
  fin: number;
}

interface Jeton extends Plage {
  forme: string;
}

function jetons(s: string): Jeton[] {
  const out: Jeton[] = [];
  for (const m of s.matchAll(/[\p{L}\p{N}]+/gu)) {
    const forme = compacter(m[0]).compact;
    if (forme) out.push({ debut: m.index!, fin: m.index! + m[0].length, forme });
  }
  return out;
}

/** En dessous de cette longueur, un terme n'est cherché que mot pour mot (« AG », « SA », « KG »). */
const LONGUEUR_MIN_COMPACTE = 5;

/** Toutes les occurrences d'un terme dans un texte, en plages du texte d'origine. */
export function trouverTerme(texte: string, terme: string): Plage[] {
  const cible = compacter(terme).compact;
  if (!cible) return [];
  const plages: Plage[] = [];
  if (cible.length >= LONGUEUR_MIN_COMPACTE) {
    const { compact, carte } = compacter(texte);
    let pos = compact.indexOf(cible);
    while (pos !== -1) {
      const debut = carte[pos];
      const dernier = carte[pos + cible.length - 1];
      // Étend jusqu'à la fin du caractère d'origine (cas des caractères multi-unités).
      plages.push({ debut, fin: dernier + (texte.codePointAt(dernier)! > 0xffff ? 2 : 1) });
      pos = compact.indexOf(cible, pos + 1);
    }
    return plages;
  }
  // Terme court : correspondance exacte d'une suite de mots.
  const motsTerme = jetons(terme).map((j) => j.forme);
  const motsTexte = jetons(texte);
  for (let i = 0; i + motsTerme.length <= motsTexte.length; i++) {
    let ok = true;
    for (let k = 0; k < motsTerme.length; k++) {
      if (motsTexte[i + k].forme !== motsTerme[k]) {
        ok = false;
        break;
      }
    }
    if (ok) plages.push({ debut: motsTexte[i].debut, fin: motsTexte[i + motsTerme.length - 1].fin });
  }
  return plages;
}

/* ------------------------------------------------------------------ motifs */

export const LIBELLES_MOTIFS: Record<Motif, string> = {
  email: "Adresse e-mail",
  url: "Adresse web",
  telephone: "Numéro de téléphone",
  tva: "Numéro de TVA",
  siret: "SIREN / SIRET / registre",
  iban: "IBAN",
};

/**
 * Motifs volontairement prudents : un plan est couvert de nombres, et une cote ne doit pas
 * être prise pour un SIRET. Les identifiants d'entreprise ne sont cherchés qu'après leur libellé.
 */
const REGEX_MOTIFS: Record<Motif, RegExp> = {
  email: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu,
  url: /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi,
  telephone:
    /(?:\+|00)\s?(?:33|49|41|32|39|43|44)[\s.()/-]*\d(?:[\s./-]*\d){7,11}|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g,
  tva: /\b(?:FR|DE|BE|IT|ES|CH|AT|LU|NL)\s?(?:[0-9A-Z]{2}\s?)?\d{3}\s?\d{3}\s?\d{3}(?:\s?\d{2,3})?\b/g,
  siret: /\b(?:SIRE[NT]|RCS|R\.C\.S\.|HRB|HRA|Handelsregister|USt-?Id(?:Nr)?\.?)\s*:?\s*[A-Z]{0,4}\s*[\d][\d\s]{4,18}\d/gi,
  iban: /\bIBAN\s*:?\s*[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?/gi,
};

export const TOUS_LES_MOTIFS: Motif[] = ["email", "url", "telephone", "tva", "siret", "iban"];

export function trouverMotifs(texte: string, motifs: Motif[] = TOUS_LES_MOTIFS): (Plage & { motif: Motif })[] {
  const out: (Plage & { motif: Motif })[] = [];
  for (const motif of motifs) {
    for (const m of texte.matchAll(REGEX_MOTIFS[motif])) {
      out.push({ debut: m.index!, fin: m.index! + m[0].length, motif });
    }
  }
  return out;
}

/* ------------------------------------------------------------- remplacement */

export interface TermeCherche {
  valeur: string;
  pseudo: string;
}

export interface Remplacement {
  de: string;
  vers: string;
}

export const MASQUE_TEXTE = "[MASQUÉ]";

/**
 * Remplace dans un texte les termes (par leur pseudonyme) et les motifs (par [MASQUÉ]).
 * Les termes les plus longs passent en premier, les chevauchements sont fusionnés.
 */
export function remplacerDansTexte(
  texte: string,
  termes: TermeCherche[],
  motifs: Motif[] = TOUS_LES_MOTIFS,
): { texte: string; remplacements: Remplacement[] } {
  const plages: (Plage & { vers: string })[] = [];
  const tries = [...termes].sort((a, b) => b.valeur.length - a.valeur.length);
  for (const t of tries) for (const p of trouverTerme(texte, t.valeur)) plages.push({ ...p, vers: t.pseudo });
  for (const p of trouverMotifs(texte, motifs)) plages.push({ ...p, vers: MASQUE_TEXTE });
  if (!plages.length) return { texte, remplacements: [] };

  plages.sort((a, b) => a.debut - b.debut || b.fin - a.fin);
  const retenues: (Plage & { vers: string })[] = [];
  for (const p of plages) {
    const der = retenues[retenues.length - 1];
    if (der && p.debut < der.fin) {
      if (p.fin > der.fin) der.fin = p.fin;
      continue;
    }
    retenues.push({ ...p });
  }
  let out = "";
  let curseur = 0;
  const remplacements: Remplacement[] = [];
  for (const p of retenues) {
    out += texte.slice(curseur, p.debut) + p.vers;
    remplacements.push({ de: texte.slice(p.debut, p.fin), vers: p.vers });
    curseur = p.fin;
  }
  out += texte.slice(curseur);
  return { texte: out, remplacements };
}

/** Vrai si le texte contient encore un terme ou un motif (utilisé par le double contrôle). */
export function contientEncore(texte: string, termes: TermeCherche[], motifs: Motif[] = TOUS_LES_MOTIFS): string[] {
  const trouves: string[] = [];
  for (const t of termes) if (trouverTerme(texte, t.valeur).length) trouves.push(t.valeur);
  for (const p of trouverMotifs(texte, motifs)) trouves.push(texte.slice(p.debut, p.fin));
  return trouves;
}

/* ------------------------------------------------- détection sur une page */

interface Ligne {
  texte: string;
  /** Pour chaque segment de la ligne : sa plage dans `texte`. */
  morceaux: { segment: Segment; debut: number; fin: number }[];
}

/** Regroupe des segments positionnés en lignes de lecture. */
export function regrouperEnLignes(segments: Segment[]): Ligne[] {
  const tries = [...segments].filter((s) => s.texte.trim()).sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const groupes: Segment[][] = [];
  for (const s of tries) {
    const centre = s.y + s.h / 2;
    const g = groupes[groupes.length - 1];
    if (g) {
      const ref = g[0];
      const refCentre = ref.y + ref.h / 2;
      if (Math.abs(centre - refCentre) < Math.min(ref.h, s.h) * 0.5) {
        g.push(s);
        continue;
      }
    }
    groupes.push([s]);
  }
  return groupes.map((g) => {
    g.sort((a, b) => a.x - b.x);
    let texte = "";
    const morceaux: Ligne["morceaux"] = [];
    for (const s of g) {
      if (texte) texte += " ";
      const debut = texte.length;
      texte += s.texte;
      morceaux.push({ segment: s, debut, fin: texte.length });
    }
    return { texte, morceaux };
  });
}

function union(rects: Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export interface Trouvaille extends Rect {
  libelle: string;
  origine: "terme" | "motif";
}

/**
 * Cherche termes et motifs dans les segments d'une page. Chaque occurrence donne le rectangle
 * qui couvre **entièrement** les segments touchés : on masque le segment, pas une partie.
 */
export function detecterSurSegments(segments: Segment[], termes: TermeCherche[], motifs: Motif[]): Trouvaille[] {
  const out: Trouvaille[] = [];
  for (const ligne of regrouperEnLignes(segments)) {
    const cibles: (Plage & { libelle: string; origine: "terme" | "motif" })[] = [];
    for (const t of termes)
      for (const p of trouverTerme(ligne.texte, t.valeur)) cibles.push({ ...p, libelle: t.pseudo, origine: "terme" });
    for (const p of trouverMotifs(ligne.texte, motifs))
      cibles.push({ ...p, libelle: LIBELLES_MOTIFS[p.motif], origine: "motif" });
    for (const c of cibles) {
      const touches = ligne.morceaux.filter((m) => m.debut < c.fin && c.debut < m.fin).map((m) => m.segment);
      if (touches.length) out.push({ ...union(touches), libelle: c.libelle, origine: c.origine });
    }
  }
  return out;
}

/** Agrandit un rectangle d'une marge (en fraction de page), borné à la page. */
export function elargir(r: Rect, marge: number): Rect {
  const x = Math.max(0, r.x - marge);
  const y = Math.max(0, r.y - marge);
  return { x, y, w: Math.min(1, r.x + r.w + marge) - x, h: Math.min(1, r.y + r.h + marge) - y };
}

/** Part de `a` recouverte par l'union approximative des rectangles `b` (échantillonnage 20×20). */
export function tauxCouverture(a: Rect, b: Rect[]): number {
  if (a.w <= 0 || a.h <= 0) return 1;
  const N = 20;
  let couverts = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const px = a.x + ((i + 0.5) / N) * a.w;
      const py = a.y + ((j + 0.5) / N) * a.h;
      if (b.some((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)) couverts++;
    }
  return couverts / (N * N);
}
