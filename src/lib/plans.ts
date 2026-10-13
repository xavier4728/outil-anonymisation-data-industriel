/**
 * Lecture et rendu des plans : PDF (vectoriels ou scannés), TIF multipages, JPG et PNG.
 * Toute coordonnée sortant de ce module est en fraction de page.
 */
import * as UTIF from "utif2";
import { ouvrirPdf, reconnaitre, Util, type DocumentPdf, type PdfOuvert } from "./moteurs";
import type { Fichier, PagePlan, Segment } from "./types";

/** Moins de caractères que ça sur une page PDF : son texte est dessiné, il faut un OCR. */
const SEUIL_TEXTE_NATIF = 20;
const MM_PAR_POINT = 25.4 / 72;

const documents = new Map<string, Promise<PdfOuvert>>();

async function documentPdf(f: Fichier): Promise<DocumentPdf> {
  let d = documents.get(f.id);
  if (!d) {
    d = f.file.arrayBuffer().then((b) => ouvrirPdf(new Uint8Array(b)));
    d.catch(() => documents.delete(f.id));
    documents.set(f.id, d);
  }
  return (await d).doc;
}

export async function fermerDocuments(): Promise<void> {
  for (const d of documents.values()) await (await d.catch(() => null))?.fermer();
  documents.clear();
}

/** Dimensions d'une page en millimètres, arrondies. */
export function formatMm(p: Pick<PagePlan, "largeurPt" | "hauteurPt">): { l: number; h: number } {
  return { l: Math.round(p.largeurPt * MM_PAR_POINT), h: Math.round(p.hauteurPt * MM_PAR_POINT) };
}

const FORMATS_ISO: [string, number, number][] = [
  ["A4", 210, 297],
  ["A3", 297, 420],
  ["A2", 420, 594],
  ["A1", 594, 841],
  ["A0", 841, 1189],
];

/** Nom lisible du format d'une page : « A3 paysage », ou les dimensions. */
export function nomFormat(lMm: number, hMm: number): string {
  const petit = Math.min(lMm, hMm);
  const grand = Math.max(lMm, hMm);
  const orientation = lMm > hMm ? "paysage" : "portrait";
  for (const [nom, a, b] of FORMATS_ISO)
    if (Math.abs(petit - a) <= 6 && Math.abs(grand - b) <= 6) return `${nom} ${orientation}`;
  return `${lMm} × ${hMm} mm`;
}

/** Identifiant de gabarit : format arrondi au format ISO, ou dimensions arrondies à 10 mm. */
export function cleGabarit(p: Pick<PagePlan, "largeurPt" | "hauteurPt">): string {
  const { l, h } = formatMm(p);
  const nom = nomFormat(l, h);
  return nom.includes("×") ? `${Math.round(l / 10) * 10}x${Math.round(h / 10) * 10}` : nom;
}

/* ------------------------------------------------------------------ lecture */

function segmentsPdf(items: unknown[], viewport: { width: number; height: number; transform: number[] }): Segment[] {
  const out: Segment[] = [];
  for (const it of items as { str?: string; transform: number[]; width: number }[]) {
    if (!it.str || !it.str.trim()) continue;
    const tx = Util.transform(viewport.transform, it.transform);
    const hauteur = Math.hypot(tx[2], tx[3]);
    const n = Math.hypot(tx[0], tx[1]) || 1;
    const d = [tx[0] / n, tx[1] / n];
    const haut = [d[1], -d[0]];
    const w = it.width;
    const px = tx[4];
    const py = tx[5];
    const coins = [
      [px, py],
      [px + d[0] * w, py + d[1] * w],
      [px + haut[0] * hauteur, py + haut[1] * hauteur],
      [px + d[0] * w + haut[0] * hauteur, py + d[1] * w + haut[1] * hauteur],
    ];
    const xs = coins.map((c) => c[0]);
    const ys = coins.map((c) => c[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    out.push({
      texte: it.str,
      x: x0 / viewport.width,
      y: y0 / viewport.height,
      w: (Math.max(...xs) - x0) / viewport.width,
      h: (Math.max(...ys) - y0) / viewport.height,
    });
  }
  return out;
}

interface PageImage {
  largeur: number;
  hauteur: number;
  dpi: number;
}

function resolutionTif(ifd: Record<string, unknown>): number {
  const brut = ifd["t282"] as number[] | undefined;
  const unite = (ifd["t296"] as number[] | undefined)?.[0] ?? 2;
  const v = Array.isArray(brut) ? Number(brut[0]) : 0;
  if (!v || !Number.isFinite(v)) return 300;
  return unite === 3 ? v * 2.54 : v;
}

async function pagesTif(f: Fichier): Promise<PageImage[]> {
  const buf = await f.file.arrayBuffer();
  const ifds = UTIF.decode(buf) as Record<string, unknown>[];
  return ifds
    .filter((ifd) => ifd["t256"] && ifd["t257"])
    .map((ifd) => ({
      largeur: (ifd["t256"] as number[])[0],
      hauteur: (ifd["t257"] as number[])[0],
      dpi: resolutionTif(ifd),
    }));
}

/** Lit un plan et décrit ses pages. N'effectue pas l'OCR. */
export async function lirePlan(f: Fichier, ocrTous: boolean): Promise<PagePlan[]> {
  if (f.type === "pdf") {
    const d = await documentPdf(f);
    const pages: PagePlan[] = [];
    for (let i = 1; i <= d.numPages; i++) {
      const p = await d.getPage(i);
      const vp = p.getViewport({ scale: 1 });
      const contenu = await p.getTextContent();
      const segmentsTexte = segmentsPdf(contenu.items, vp);
      const nbCar = segmentsTexte.reduce((n, s) => n + s.texte.trim().length, 0);
      pages.push({
        id: `${f.id}#${i}`,
        fichierId: f.id,
        index: i - 1,
        largeurPt: vp.width,
        hauteurPt: vp.height,
        gabaritId: "",
        segmentsTexte,
        segmentsOcr: null,
        ocrRequis: ocrTous || nbCar < SEUIL_TEXTE_NATIF,
      });
    }
    return pages;
  }
  let images: PageImage[];
  if (f.type === "tif") images = await pagesTif(f);
  else {
    const bmp = await createImageBitmap(f.file);
    images = [{ largeur: bmp.width, hauteur: bmp.height, dpi: 200 }];
    bmp.close();
  }
  return images.map((im, i) => ({
    id: `${f.id}#${i + 1}`,
    fichierId: f.id,
    index: i,
    largeurPt: (im.largeur / im.dpi) * 72,
    hauteurPt: (im.hauteur / im.dpi) * 72,
    gabaritId: "",
    segmentsTexte: [],
    segmentsOcr: null,
    ocrRequis: true,
    dpiSource: im.dpi,
  }));
}

/* -------------------------------------------------------------------- rendu */

/** Nombre maximal de pixels d'une image de sortie (au-delà, la résolution est abaissée). */
export const PIXELS_MAX = 36_000_000;

function canevas(l: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(l));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Dessine une page sur un canevas de la largeur demandée (en pixels). */
export async function rendrePage(f: Fichier, page: PagePlan, largeurPx: number): Promise<HTMLCanvasElement> {
  const ratio = page.hauteurPt / page.largeurPt;
  const c = canevas(largeurPx, largeurPx * ratio);
  const ctx = c.getContext("2d", { willReadFrequently: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  if (f.type === "pdf") {
    const d = await documentPdf(f);
    const p = await d.getPage(page.index + 1);
    const vp = p.getViewport({ scale: c.width / p.getViewport({ scale: 1 }).width });
    await p.render({ canvas: c, canvasContext: ctx, viewport: vp, background: "#ffffff" }).promise;
    return c;
  }
  if (f.type === "tif") {
    const buf = await f.file.arrayBuffer();
    const ifds = (UTIF.decode(buf) as Record<string, unknown>[]).filter((ifd) => ifd["t256"] && ifd["t257"]);
    const ifd = ifds[page.index];
    UTIF.decodeImage(buf, ifd as never);
    const rgba = UTIF.toRGBA8(ifd as never);
    const l = (ifd["t256"] as number[])[0];
    const h = (ifd["t257"] as number[])[0];
    const pixels = new Uint8ClampedArray(l * h * 4);
    pixels.set(rgba.subarray(0, l * h * 4));
    const bmp = await createImageBitmap(new ImageData(pixels, l, h));
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c;
  }
  const bmp = await createImageBitmap(f.file);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

/** Largeur en pixels pour une sortie à `dpi`, bornée par la taille maximale et par la source. */
export function largeurSortie(page: PagePlan, dpi: number): { largeur: number; dpiEffectif: number } {
  let dpiCible = page.dpiSource ? Math.min(dpi, page.dpiSource) : dpi;
  const pixels = (d: number) => ((page.largeurPt / 72) * d) * ((page.hauteurPt / 72) * d);
  if (pixels(dpiCible) > PIXELS_MAX) dpiCible = Math.sqrt(PIXELS_MAX / pixels(1));
  return { largeur: Math.round((page.largeurPt / 72) * dpiCible), dpiEffectif: Math.round(dpiCible) };
}

export function versBlob(c: HTMLCanvasElement, type: string, qualite?: number): Promise<Blob> {
  return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("Encodage de l'image impossible"))), type, qualite));
}

/* ---------------------------------------------------------------------- OCR */

/** Côté le plus long de l'image envoyée à l'OCR, en pixels. */
const COTE_OCR = 4200;

export async function ocrPage(f: Fichier, page: PagePlan): Promise<Segment[]> {
  const ratio = page.hauteurPt / page.largeurPt;
  const largeur = ratio >= 1 ? COTE_OCR / ratio : COTE_OCR;
  const src = largeurSortie(page, 300).largeur;
  const c = await rendrePage(f, page, Math.min(largeur, Math.max(src, 1600)));
  const mots = await reconnaitre(await versBlob(c, "image/png"));
  return mots.map((m) => ({
    texte: m.texte,
    x: m.x0 / c.width,
    y: m.y0 / c.height,
    w: (m.x1 - m.x0) / c.width,
    h: (m.y1 - m.y0) / c.height,
  }));
}
