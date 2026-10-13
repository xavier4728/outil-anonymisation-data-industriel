/**
 * Les deux moteurs embarqués : pdf.js (lecture des PDF) et Tesseract (OCR).
 *
 * Tout ce dont ils ont besoin (décodeurs, langues, cœur wasm) est **inclus dans la page**.
 * Aucun des deux ne peut télécharger quoi que ce soit : le verrou réseau de la page
 * (Content-Security-Policy) l'interdit, et le chargeur des langues refuse toute URL.
 */
import * as pdfjs from "pdfjs-dist";
import * as pdfWorker from "pdfjs-dist/build/pdf.worker.mjs";
import { createWorker, OEM, PSM, type Worker as TessWorker } from "tesseract.js";

import jbig2B64 from "pdfjs-dist/wasm/jbig2.wasm?b64";
import openjpegB64 from "pdfjs-dist/wasm/openjpeg.wasm?b64";
import qcmsB64 from "pdfjs-dist/wasm/qcms_bg.wasm?b64";
import tessWorkerSrc from "tesseract.js/dist/worker.min.js?raw";
import tessCoreSrc from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?raw";
import fraB64 from "@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz?b64";
import deuB64 from "@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz?b64";
import engB64 from "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz?b64";

/* ------------------------------------------------------------------ pdf.js */

// pdf.js tourne sur le fil principal : aucun fichier « worker » à charger.
(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfWorker;
pdfjs.GlobalWorkerOptions.workerSrc = "embarque://pdf.worker";

function base64VersOctets(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const WASM_PDF: Record<string, string> = {
  "jbig2.wasm": jbig2B64,
  "openjpeg.wasm": openjpegB64,
  "qcms_bg.wasm": qcmsB64,
};

/** Fournit à pdf.js ses décodeurs (JBIG2, CCITT, JPEG 2000) depuis la page, sans réseau. */
class FabriqueEmbarquee {
  constructor(_: unknown) {}
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    if (kind === "wasmUrl" && WASM_PDF[filename]) return base64VersOctets(WASM_PDF[filename]);
    throw new Error(`EvMasque : ressource non embarquée (${kind} ${filename})`);
  }
}

export type DocumentPdf = pdfjs.PDFDocumentProxy;
export type PagePdf = pdfjs.PDFPageProxy;

export interface PdfOuvert {
  doc: DocumentPdf;
  fermer: () => Promise<void>;
}

export async function ouvrirPdf(octets: Uint8Array): Promise<PdfOuvert> {
  const tache = pdfjs.getDocument({
    data: octets,
    useWorkerFetch: false,
    // Option présente dans pdf.js 6, absente des types publiés.
    BinaryDataFactory: FabriqueEmbarquee,
    isEvalSupported: false,
    useSystemFonts: true,
    enableXfa: false,
    stopAtErrors: false,
  } as Parameters<typeof pdfjs.getDocument>[0]);
  const doc = await tache.promise;
  return { doc, fermer: () => tache.destroy() };
}

export const Util = pdfjs.Util;

/* --------------------------------------------------------------- Tesseract */

const LANGUES: Record<string, string> = { fra: fraB64, deu: deuB64, eng: engB64 };
const DOMAINE_LANGUES = "https://langues.evmasque.invalid";

/**
 * Le script du worker OCR, d'un seul tenant : chargeur de langues, cœur Tesseract (wasm inclus)
 * et worker Tesseract. Une page ouverte depuis un fichier local ne peut pas charger un second
 * script depuis son worker : tout doit donc être dans le même script.
 */
function scriptWorkerTesseract(): string {
  // Le chargeur remplace `fetch` : seules les trois langues embarquées peuvent être « chargées »,
  // toute autre demande est refusée.
  const chargeur = `
const LANGUES = ${JSON.stringify(LANGUES)};
self.fetch = function (url) {
  const u = String(url);
  const nom = u.slice(u.lastIndexOf("/") + 1).replace(".gz", "");
  const code = nom.split(".")[0];
  if (u.startsWith(${JSON.stringify(DOMAINE_LANGUES + "/")}) && nom === code + ".traineddata" && LANGUES[code]) {
    const bin = atob(LANGUES[code]);
    const octets = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
    return Promise.resolve(new Response(octets));
  }
  return Promise.reject(new Error("EvMasque : aucune connexion réseau n'est autorisée"));
};
`;
  // Le cœur définit `TesseractCore` : le worker le trouve et ne cherche plus à le télécharger.
  return `${chargeur}
;${tessCoreSrc}
;self.TesseractCore = self.TesseractCore || TesseractCore;
;${tessWorkerSrc}
`;
}

let urlWorker: string | null = null;
function urlWorkerTesseract(): string {
  if (!urlWorker) urlWorker = URL.createObjectURL(new Blob([scriptWorkerTesseract()], { type: "text/javascript" }));
  return urlWorker;
}

let workerOcr: Promise<TessWorker> | null = null;

export function moteurOcr(): Promise<TessWorker> {
  if (!workerOcr) {
    workerOcr = createWorker(["fra", "deu", "eng"], OEM.LSTM_ONLY, {
      workerPath: urlWorkerTesseract(),
      workerBlobURL: false,
      corePath: "embarque://tesseract-core.wasm.js",
      langPath: DOMAINE_LANGUES,
      cacheMethod: "none",
      gzip: true,
    }).then(async (w) => {
      // Texte épars : un plan n'est pas une page de livre.
      await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: "1" });
      return w;
    });
    workerOcr.catch(() => {
      workerOcr = null;
    });
  }
  return workerOcr;
}

export interface MotOcr {
  texte: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  confiance: number;
}

export async function reconnaitre(image: Blob): Promise<MotOcr[]> {
  const w = await moteurOcr();
  const { data } = await w.recognize(image, {}, { blocks: true, text: false });
  const mots: MotOcr[] = [];
  for (const bloc of data.blocks ?? [])
    for (const para of bloc.paragraphs)
      for (const ligne of para.lines)
        for (const mot of ligne.words) {
          const t = mot.text.trim();
          if (!t) continue;
          mots.push({ texte: t, x0: mot.bbox.x0, y0: mot.bbox.y0, x1: mot.bbox.x1, y1: mot.bbox.y1, confiance: mot.confidence });
        }
  return mots;
}

export async function arreterOcr(): Promise<void> {
  if (workerOcr) {
    const w = await workerOcr.catch(() => null);
    workerOcr = null;
    await w?.terminate();
  }
}
