/** Ce qui sera masqué sur chaque page : zones de cartouche, termes et motifs trouvés, ajouts manuels. */
import { detecterSurSegments, elargir, type TermeCherche } from "./texte";
import type { Detection, EtatPage, Gabarit, Motif, PagePlan, Rect, Terme } from "./types";

/** Marge ajoutée autour d'un texte trouvé, en fraction de page (≈ 1 mm sur un A3). */
const MARGE = 0.0025;

export function termesActifs(termes: Terme[]): TermeCherche[] {
  return termes.filter((t) => t.actif && t.valeur.trim()).map((t) => ({ valeur: t.valeur, pseudo: t.pseudo }));
}

export function segmentsDe(page: PagePlan) {
  return [...page.segmentsTexte, ...(page.segmentsOcr ?? [])];
}

export function detecter(page: PagePlan, gabarit: Gabarit | undefined, termes: TermeCherche[], motifs: Motif[]): Detection[] {
  const out: Detection[] = [];
  (gabarit?.zones ?? []).forEach((z, i) =>
    out.push({ ...z, id: `${page.id}:z${i}`, pageId: page.id, origine: "zone", libelle: "Cartouche / zone" }),
  );
  const trouvailles = detecterSurSegments(segmentsDe(page), termes, motifs);
  trouvailles.forEach((t, i) =>
    out.push({ ...elargir(t, MARGE), id: `${page.id}:d${i}`, pageId: page.id, origine: t.origine, libelle: t.libelle }),
  );
  return out;
}

/** Les rectangles réellement noircis sur la page. */
export function masquesFinaux(detections: Detection[], etat: EtatPage | undefined): Rect[] {
  const retirees = new Set(etat?.retirees ?? []);
  return [...detections.filter((d) => !retirees.has(d.id)), ...(etat?.manuels ?? [])].map(({ x, y, w, h }) => ({ x, y, w, h }));
}

/** Zone de cartouche proposée par défaut : bas droite, 190 × 60 mm (ISO 7200 avec marge). */
export function cartoucheParDefaut(largeurMm: number, hauteurMm: number): Rect {
  const w = Math.min(0.95, 195 / largeurMm);
  const h = Math.min(0.45, 65 / hauteurMm);
  return { x: 1 - w - 5 / largeurMm, y: 1 - h - 5 / hauteurMm, w, h };
}

export function dessiner(ctx: CanvasRenderingContext2D, rects: Rect[], l: number, h: number): void {
  ctx.fillStyle = "#000000";
  for (const r of rects) ctx.fillRect(Math.floor(r.x * l), Math.floor(r.y * h), Math.ceil(r.w * l) + 1, Math.ceil(r.h * h) + 1);
}
