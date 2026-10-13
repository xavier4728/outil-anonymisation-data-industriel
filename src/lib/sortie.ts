/**
 * Fabrication des fichiers de sortie et double contrôle.
 *
 * Un plan anonymisé est un PDF **neuf**, fait d'une image par page : le plan est redessiné,
 * les zones sont noircies dans les pixels, puis l'image est placée dans un document vide.
 * Rien du fichier d'origine (texte, calques, métadonnées, pièces jointes, versions
 * antérieures) n'est recopié.
 */
import { PDFDocument } from "pdf-lib";
import { ouvrirPdf } from "./moteurs";
import { dessiner } from "./masquage";
import { largeurSortie, rendrePage, versBlob } from "./plans";
import { contientEncore, tauxCouverture, type TermeCherche } from "./texte";
import type { Detection, Fichier, Motif, PagePlan, Rect } from "./types";

const DATE_NEUTRE = new Date("2000-01-01T00:00:00Z");

export interface PlanProduit {
  octets: Uint8Array;
  dpi: number[];
  masques: number;
}

export async function produirePlan(
  f: Fichier,
  pages: PagePlan[],
  masques: (page: PagePlan) => Rect[],
  dpi: number,
  progression?: (i: number) => void,
): Promise<PlanProduit> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("");
  pdf.setAuthor("");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setCreator("EvMasque");
  pdf.setProducer("EvMasque");
  pdf.setCreationDate(DATE_NEUTRE);
  pdf.setModificationDate(DATE_NEUTRE);
  const dpis: number[] = [];
  let total = 0;
  for (const [i, page] of pages.entries()) {
    const { largeur, dpiEffectif } = largeurSortie(page, dpi);
    const c = await rendrePage(f, page, largeur);
    const rects = masques(page);
    total += rects.length;
    dessiner(c.getContext("2d")!, rects, c.width, c.height);
    const jpg = new Uint8Array(await (await versBlob(c, "image/jpeg", 0.92)).arrayBuffer());
    c.width = c.height = 0; // libère la mémoire du canevas
    const image = await pdf.embedJpg(jpg);
    const p = pdf.addPage([page.largeurPt, page.hauteurPt]);
    p.drawImage(image, { x: 0, y: 0, width: page.largeurPt, height: page.hauteurPt });
    dpis.push(dpiEffectif);
    progression?.(i + 1);
  }
  const octets = await pdf.save({ useObjectStreams: true });
  return { octets, dpi: dpis, masques: total };
}

/* ------------------------------------------------------------ double contrôle */

export interface ResultatControle {
  bloquants: string[];
  attentions: string[];
  verifications: string[];
}

/** Relit le PDF produit : il ne doit contenir ni texte, ni métadonnée, ni pièce jointe. */
export async function controlerPdfProduit(octets: Uint8Array): Promise<ResultatControle> {
  const r: ResultatControle = { bloquants: [], attentions: [], verifications: [] };
  const { doc: d, fermer } = await ouvrirPdf(octets.slice());
  try {
    let caracteres = 0;
    for (let i = 1; i <= d.numPages; i++) {
      const contenu = await (await d.getPage(i)).getTextContent();
      for (const it of contenu.items as { str?: string }[]) caracteres += (it.str ?? "").trim().length;
    }
    if (caracteres) r.bloquants.push(`Le PDF produit contient encore ${caracteres} caractères de texte`);
    else r.verifications.push("Aucun texte lisible par machine dans le PDF produit, seulement des images");
    const meta = await d.getMetadata();
    const info = meta.info as Record<string, unknown>;
    const champs = ["Title", "Author", "Subject", "Keywords"].filter((k) => String(info[k] ?? "").trim());
    if (champs.length || meta.metadata) r.bloquants.push(`Métadonnées présentes : ${champs.join(", ") || "XMP"}`);
    else r.verifications.push("Métadonnées vides (titre, auteur, sujet, mots-clés)");
    const pj = await d.getAttachments();
    if (pj && Object.keys(pj).length) r.bloquants.push("Pièce jointe présente dans le PDF produit");
  } finally {
    await fermer();
  }
  return r;
}

/**
 * Vérifie que chaque occurrence trouvée est couverte par un masque.
 * Les occurrences décochées volontairement sont signalées, pas bloquées.
 */
export function controlerCouverture(
  pages: { page: PagePlan; detections: Detection[]; masques: Rect[]; retirees: Set<string> }[],
): ResultatControle {
  const r: ResultatControle = { bloquants: [], attentions: [], verifications: [] };
  let occurrences = 0;
  for (const { page, detections, masques, retirees } of pages) {
    if (page.ocrRequis && page.segmentsOcr === null) {
      r.bloquants.push(`Page ${page.index + 1} : pas encore lue par l'OCR`);
      continue;
    }
    if (page.ocrRequis && page.segmentsOcr && page.segmentsOcr.length === 0 && !page.segmentsTexte.length)
      r.attentions.push(`Page ${page.index + 1} : aucun texte reconnu, vérifiez-la à l'œil`);
    for (const d of detections) {
      if (d.origine === "zone") continue;
      occurrences++;
      if (retirees.has(d.id)) {
        r.attentions.push(`Page ${page.index + 1} : « ${d.libelle} » laissé visible à votre demande`);
        continue;
      }
      if (tauxCouverture(d, masques) < 0.95) r.bloquants.push(`Page ${page.index + 1} : « ${d.libelle} » mal couvert`);
    }
  }
  if (!r.bloquants.length) r.verifications.push(`${occurrences} occurrence(s) de termes et de coordonnées couvertes`);
  return r;
}

export function controlerNom(nom: string, termes: TermeCherche[], motifs: Motif[]): string[] {
  return contientEncore(nom, termes, motifs);
}

/* ---------------------------------------------------------------- empreintes */

export async function sha256(octets: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", octets.slice().buffer);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
