/** Types partagés d'EvMasque. Toutes les coordonnées de page sont en fractions [0, 1]. */

export type TypeFichier = "pdf" | "tif" | "image" | "step" | "tableur" | "ignore";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Un morceau de texte positionné sur une page (texte du PDF ou mot reconnu par l'OCR). */
export interface Segment extends Rect {
  texte: string;
}

export interface Terme {
  id: string;
  valeur: string;
  actif: boolean;
  origine: "saisie" | "suggestion" | "piece";
  pseudo: string;
}

export interface Suggestion {
  valeur: string;
  raison: string;
  occurrences: number;
}

/** Ce que l'outil cherche à masquer, au-delà du dictionnaire. */
export type Motif = "email" | "url" | "telephone" | "tva" | "siret" | "iban";

export interface Fichier {
  id: string;
  chemin: string;
  nom: string;
  extension: string;
  type: TypeFichier;
  taille: number;
  file: File;
  pieceCle: string;
}

export interface Piece {
  cle: string;
  pseudo: string;
}

export interface Gabarit {
  id: string;
  libelle: string;
  largeurMm: number;
  hauteurMm: number;
  zones: Rect[];
}

export interface PagePlan {
  id: string;
  fichierId: string;
  index: number;
  largeurPt: number;
  hauteurPt: number;
  gabaritId: string;
  /** Texte natif du PDF (vide pour une image ou un plan vectorisé). */
  segmentsTexte: Segment[];
  /** Mots lus par l'OCR. `null` tant que l'OCR n'a pas tourné. */
  segmentsOcr: Segment[] | null;
  /** La page demande un OCR (scan, image, ou PDF dont le texte est dessiné). */
  ocrRequis: boolean;
  /** Pour une image : résolution d'origine en points par pouce. */
  dpiSource?: number;
}

export type OrigineDetection = "terme" | "motif" | "zone";

export interface Detection extends Rect {
  id: string;
  pageId: string;
  origine: OrigineDetection;
  libelle: string;
}

export interface EtatPage {
  /** Détections décochées par l'utilisateur. */
  retirees: string[];
  /** Rectangles ajoutés à la main. */
  manuels: Rect[];
}

export type Severite = "ok" | "attention" | "bloquant";

export interface Controle {
  fichierId: string;
  severite: Severite;
  messages: string[];
}

export interface Options {
  dpiSortie: number;
  ocrTousLesPlans: boolean;
  retirerColonnesPrix: boolean;
  inclureFeuillesMasquees: boolean;
  archiveChiffree: boolean;
}

export const OPTIONS_DEFAUT: Options = {
  dpiSortie: 300,
  ocrTousLesPlans: false,
  retirerColonnesPrix: true,
  inclureFeuillesMasquees: false,
  archiveChiffree: true,
};
