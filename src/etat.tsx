/**
 * L'état de l'application et les actions qui le font avancer.
 * Tout vit dans la mémoire de l'onglet : rien n'est envoyé, rien n'est conservé ailleurs.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { attribuerPseudos, creerTerme, memeValeur, numeroterPieces, suggerer, type TexteSource } from "./lib/dictionnaire";
import { creerFichier, extensionSortie, referencesDansLesNoms, roleSortie } from "./lib/inventaire";
import { cartoucheParDefaut, detecter, masquesFinaux, termesActifs } from "./lib/masquage";
import { cleGabarit, formatMm, lirePlan, nomFormat, ocrPage } from "./lib/plans";
import { analyserTableur, anonymiserTableur, fuitesTableur, type TableurAnalyse } from "./lib/tableur";
import { anonymiserStep, fuitesStep, indicesStep, verifierIntegrite } from "./lib/step";
import { TOUS_LES_MOTIFS, regrouperEnLignes } from "./lib/texte";
import { controlerCouverture, controlerNom, controlerPdfProduit, produirePlan, sha256 } from "./lib/sortie";
import type { FichierProduit } from "./lib/livrables";
import {
  OPTIONS_DEFAUT,
  type Detection,
  type EtatPage,
  type Fichier,
  type Gabarit,
  type Motif,
  type Options,
  type PagePlan,
  type Piece,
  type Rect,
  type Suggestion,
  type Terme,
} from "./lib/types";

export type Vue = "accueil" | 1 | 2 | 3 | 4 | 5 | "methodes" | "chiffrement" | "aide";

export interface Avancement {
  fait: number;
  total: number;
  libelle: string;
}

export interface Etat {
  vue: Vue;
  fichiers: Fichier[];
  pages: PagePlan[];
  gabarits: Gabarit[];
  tableurs: Record<string, TableurAnalyse>;
  steps: Record<string, string>;
  textesStep: Record<string, string[]>;
  termes: Terme[];
  suggestions: Suggestion[];
  rejetees: string[];
  motifs: Motif[];
  options: Options;
  /** Colonnes de prix retirées : fichierId → feuille → indices. */
  colonnes: Record<string, Record<string, number[]>>;
  etatsPages: Record<string, EtatPage>;
  valides: Record<string, boolean>;
  analyse: Avancement | null;
  ocr: Avancement | null;
  production: Avancement | null;
  produits: FichierProduit[];
  erreurs: string[];
}

const INITIAL: Etat = {
  vue: "accueil",
  fichiers: [],
  pages: [],
  gabarits: [],
  tableurs: {},
  steps: {},
  textesStep: {},
  termes: [],
  suggestions: [],
  rejetees: [],
  motifs: [...TOUS_LES_MOTIFS],
  options: OPTIONS_DEFAUT,
  colonnes: {},
  etatsPages: {},
  valides: {},
  analyse: null,
  ocr: null,
  production: null,
  produits: [],
  erreurs: [],
};

/* ---------------------------------------------------------------- utilitaires */

export function piecesDe(fichiers: Fichier[]): Piece[] {
  return numeroterPieces(fichiers.filter((f) => f.type !== "ignore").map((f) => f.pieceCle));
}

function textesPourSuggestions(e: Etat): TexteSource[] {
  const out: TexteSource[] = [];
  for (const p of e.pages)
    for (const l of regrouperEnLignes([...p.segmentsTexte, ...(p.segmentsOcr ?? [])])) out.push({ texte: l.texte, origine: "plan" });
  for (const [id, t] of Object.entries(e.tableurs)) {
    for (const x of t.textes) out.push({ texte: x, origine: id });
    for (const v of t.valeursClient) out.push({ texte: `Client : ${v}`, origine: id });
  }
  for (const textes of Object.values(e.textesStep)) for (const t of textes) out.push({ texte: t, origine: "step" });
  return out;
}

function recalculerSuggestions(e: Etat): Etat {
  const refs = referencesDansLesNoms(e.fichiers.filter((f) => f.type !== "ignore"));
  const s = suggerer(textesPourSuggestions(e), refs, [...e.termes.map((t) => t.valeur), ...e.rejetees]);
  return { ...e, suggestions: s };
}

/** Les références des pièces entrent d'office dans le dictionnaire. */
function synchroniserPieces(e: Etat): Etat {
  const pieces = piecesDe(e.fichiers);
  let termes = e.termes.filter((t) => t.origine !== "piece" || pieces.some((p) => memeValeur(p.cle, t.valeur)));
  for (const p of pieces)
    if (!termes.some((t) => memeValeur(t.valeur, p.cle))) termes = [...termes, creerTerme(p.cle, "piece")];
  return { ...e, termes: attribuerPseudos(termes, pieces) };
}

function construireGabarits(pages: PagePlan[], existants: Gabarit[]): { pages: PagePlan[]; gabarits: Gabarit[] } {
  const gabarits = [...existants];
  const out = pages.map((p) => {
    const cle = cleGabarit(p);
    if (!gabarits.some((g) => g.id === cle)) {
      const { l, h } = formatMm(p);
      gabarits.push({ id: cle, libelle: nomFormat(l, h), largeurMm: l, hauteurMm: h, zones: [cartoucheParDefaut(l, h)] });
    }
    return { ...p, gabaritId: cle };
  });
  return { pages: out, gabarits };
}

export function nomSortie(f: Fichier, fichiers: Fichier[], pieces: Piece[]): string {
  const pseudo = pieces.find((p) => p.cle === f.pieceCle)?.pseudo ?? "P-000";
  const role = roleSortie(f.type);
  const memes = fichiers.filter((x) => x.type !== "ignore" && x.pieceCle === f.pieceCle && roleSortie(x.type) === role);
  const rang = memes.findIndex((x) => x.id === f.id);
  return `${pseudo}_${role}${memes.length > 1 ? `-${rang + 1}` : ""}.${extensionSortie(f)}`;
}

/* ------------------------------------------------------------------- contexte */

interface Actions {
  e: Etat;
  aller: (v: Vue) => void;
  deposer: (entrees: { file: File; chemin: string }[]) => Promise<void>;
  reinitialiser: () => void;
  changerPiece: (fichierId: string, cle: string) => void;
  exclure: (fichierId: string) => void;
  ajouterTerme: (valeur: string) => void;
  modifierTerme: (id: string, modif: Partial<Terme>) => void;
  supprimerTerme: (id: string) => void;
  accepterSuggestion: (s: Suggestion) => void;
  rejeterSuggestion: (s: Suggestion) => void;
  basculerMotif: (m: Motif) => void;
  options: (o: Partial<Options>) => void;
  lancerOcr: () => void;
  basculerColonne: (fichierId: string, feuille: string, j: number) => void;
  majZones: (gabaritId: string, zones: Rect[]) => void;
  detectionsPage: (page: PagePlan) => Detection[];
  basculerDetection: (pageId: string, detId: string) => void;
  ajouterManuel: (pageId: string, r: Rect) => void;
  retirerManuel: (pageId: string, i: number) => void;
  valider: (fichierId: string, ok: boolean) => void;
  produire: () => Promise<void>;
  chargerProjet: (json: string) => void;
  projet: () => string;
}

const Ctx = createContext<Actions | null>(null);

export function useEv(): Actions {
  const a = useContext(Ctx);
  if (!a) throw new Error("Contexte EvMasque absent");
  return a;
}

export function Fournisseur({ children }: { children: ReactNode }) {
  const [e, setE] = useState<Etat>(INITIAL);
  const ref = useRef(e);
  ref.current = e;
  const maj = useCallback((f: (x: Etat) => Etat) => {
    setE((x) => {
      const n = f(x);
      ref.current = n;
      return n;
    });
  }, []);

  const lancerOcr = useCallback(async () => {
    const aLire = () => ref.current.pages.filter((p) => p.ocrRequis && p.segmentsOcr === null);
    const total = aLire().length;
    if (!total || ref.current.ocr) return;
    let fait = 0;
    maj((x) => ({ ...x, ocr: { fait, total, libelle: "Lecture des plans scannés" } }));
    for (;;) {
      const page = aLire()[0];
      if (!page) break;
      const f = ref.current.fichiers.find((x) => x.id === page.fichierId);
      let segments: PagePlan["segmentsOcr"] = [];
      try {
        if (f) segments = await ocrPage(f, page);
      } catch (err) {
        maj((x) => ({ ...x, erreurs: [...x.erreurs, `OCR impossible sur ${f?.nom} p.${page.index + 1} : ${String(err)}`] }));
      }
      fait++;
      maj((x) =>
        recalculerSuggestions({
          ...x,
          pages: x.pages.map((p) => (p.id === page.id ? { ...p, segmentsOcr: segments } : p)),
          ocr: { fait, total: Math.max(total, fait), libelle: "Lecture des plans scannés" },
        }),
      );
    }
    maj((x) => ({ ...x, ocr: null }));
  }, [maj]);

  const deposer = useCallback(
    async (entrees: { file: File; chemin: string }[]) => {
      const nouveaux = entrees.map((en) => creerFichier(en.file, en.chemin));
      maj((x) => ({ ...x, fichiers: [...x.fichiers, ...nouveaux], analyse: { fait: 0, total: nouveaux.length, libelle: "Lecture des fichiers" } }));
      let fait = 0;
      for (const f of nouveaux) {
        try {
          if (f.type === "pdf" || f.type === "tif" || f.type === "image") {
            const pages = await lirePlan(f, ref.current.options.ocrTousLesPlans);
            maj((x) => {
              const g = construireGabarits(pages, x.gabarits);
              return { ...x, pages: [...x.pages, ...g.pages], gabarits: g.gabarits };
            });
          } else if (f.type === "tableur") {
            const analyse = analyserTableur(await f.file.arrayBuffer(), f.extension);
            maj((x) => ({
              ...x,
              tableurs: { ...x.tableurs, [f.id]: analyse },
              colonnes: {
                ...x.colonnes,
                [f.id]: Object.fromEntries(analyse.feuilles.map((fe) => [fe.nom, x.options.retirerColonnesPrix ? fe.colonnesPrix : []])),
              },
            }));
          } else if (f.type === "step") {
            const texte = await f.file.text();
            const ind = indicesStep(texte);
            const textes = [
              ...ind.produits.map((p) => `N° de plan : ${p}`),
              ...ind.organisations.map((o) => `Client : ${o}`),
              ...ind.personnes.map((p) => `Auteur : ${p}`),
              ...ind.textes,
            ];
            maj((x) => ({ ...x, steps: { ...x.steps, [f.id]: texte }, textesStep: { ...x.textesStep, [f.id]: textes } }));
          }
        } catch (err) {
          maj((x) => ({
            ...x,
            erreurs: [...x.erreurs, `Lecture impossible : ${f.nom} (${String(err)})`],
            fichiers: x.fichiers.map((y) => (y.id === f.id ? { ...y, type: "ignore" } : y)),
          }));
        }
        fait++;
        maj((x) => ({ ...x, analyse: { fait, total: nouveaux.length, libelle: "Lecture des fichiers" } }));
      }
      maj((x) => recalculerSuggestions(synchroniserPieces({ ...x, analyse: null })));
      void lancerOcr();
    },
    [maj, lancerOcr],
  );

  // Les détections dépendent des termes, des motifs et des zones : on les recalcule à la demande.
  const cacheDetections = useRef(new Map<string, { cle: string; d: Detection[] }>());
  const detectionsPage = useCallback((page: PagePlan) => {
    const x = ref.current;
    const gabarit = x.gabarits.find((g) => g.id === page.gabaritId);
    const termes = termesActifs(x.termes);
    const cle = JSON.stringify([termes.map((t) => t.valeur + t.pseudo), x.motifs, gabarit?.zones, page.segmentsOcr?.length ?? -1]);
    const c = cacheDetections.current.get(page.id);
    if (c && c.cle === cle) return c.d;
    const d = detecter(page, gabarit, termes, x.motifs);
    cacheDetections.current.set(page.id, { cle, d });
    return d;
  }, []);

  const produire = useCallback(async () => {
    const x = ref.current;
    const pieces = piecesDe(x.fichiers);
    const termes = termesActifs(x.termes);
    const motifs = x.motifs;
    const aTraiter = x.fichiers.filter((f) => f.type !== "ignore");
    const produits: FichierProduit[] = [];
    const total = aTraiter.length;
    maj((y) => ({ ...y, production: { fait: 0, total, libelle: "Production des fichiers" }, produits: [] }));
    for (const [i, f] of aTraiter.entries()) {
      const nom = nomSortie(f, aTraiter, pieces);
      const pseudo = pieces.find((p) => p.cle === f.pieceCle)?.pseudo ?? "P-000";
      const bilan: string[] = [];
      const verifications: string[] = [];
      const alertes: string[] = [];
      const bloquants: string[] = [];
      let octets: Uint8Array = new Uint8Array();
      try {
        if (f.type === "pdf" || f.type === "tif" || f.type === "image") {
          const pages = x.pages.filter((p) => p.fichierId === f.id).sort((a, b) => a.index - b.index);
          const parPage = pages.map((page) => {
            const detections = detectionsPage(page);
            const etat = x.etatsPages[page.id];
            return { page, detections, masques: masquesFinaux(detections, etat), retirees: new Set(etat?.retirees ?? []) };
          });
          const couverture = controlerCouverture(parPage);
          const plan = await produirePlan(f, pages, (p) => parPage.find((q) => q.page.id === p.id)!.masques, x.options.dpiSortie);
          octets = plan.octets;
          const zones = parPage.reduce((n, q) => n + q.detections.filter((d) => d.origine === "zone" && !q.retirees.has(d.id)).length, 0);
          const textes = parPage.reduce((n, q) => n + q.detections.filter((d) => d.origine !== "zone" && !q.retirees.has(d.id)).length, 0);
          const manuels = parPage.reduce((n, q) => n + (x.etatsPages[q.page.id]?.manuels.length ?? 0), 0);
          bilan.push(
            `${pages.length} page(s) redessinée(s) en image, ${
              Math.min(...plan.dpi) === Math.max(...plan.dpi) ? Math.min(...plan.dpi) : `${Math.min(...plan.dpi)} à ${Math.max(...plan.dpi)}`
            } points par pouce`,
            `${zones} zone(s) de cartouche, ${textes} texte(s) trouvé(s) et ${manuels} ajout(s) manuel(s) masqués`,
          );
          if (Math.min(...plan.dpi) < 200) alertes.push("Résolution inférieure à 200 points par pouce sur une page de grand format");
          const ctrl = await controlerPdfProduit(octets);
          bloquants.push(...couverture.bloquants, ...ctrl.bloquants);
          alertes.push(...couverture.attentions, ...ctrl.attentions);
          verifications.push(...couverture.verifications, ...ctrl.verifications);
        } else if (f.type === "step") {
          const source = x.steps[f.id];
          const r = anonymiserStep(source, termes, motifs, pseudo, nom);
          octets = new TextEncoder().encode(r.texte);
          bilan.push(`${r.chainesModifiees} chaîne(s) d'identification réécrite(s), ${r.commentairesRetires} commentaire(s) retiré(s)`);
          const integ = verifierIntegrite(source, r.texte);
          (integ.ok ? verifications : bloquants).push(integ.message);
          const fuites = fuitesStep(r.texte, termes, motifs);
          if (fuites.length) bloquants.push(`${fuites.length} terme(s) encore présent(s) après traitement`);
          else verifications.push("Aucun terme du dictionnaire ni coordonnée dans le fichier produit");
        } else if (f.type === "tableur") {
          const analyse = x.tableurs[f.id];
          const r = anonymiserTableur(analyse, f.extension, termes, motifs, {
            inclureMasquees: x.options.inclureFeuillesMasquees,
            colonnesRetirees: x.colonnes[f.id] ?? {},
          });
          octets = r.octets;
          bilan.push(
            `Classeur reconstruit, valeurs seules (ni formule, ni propriété, ni commentaire, ni image)`,
            `${r.cellulesModifiees} cellule(s) modifiée(s), ${r.colonnesRetirees.length} colonne(s) de prix retirée(s), ${r.feuillesRetirees.length} feuille(s) masquée(s) écartée(s)`,
          );
          const ext = f.extension === "csv" ? "csv" : "xlsx";
          const fuites = fuitesTableur(octets, ext, termes, motifs);
          if (fuites.length) bloquants.push(`${fuites.length} terme(s) encore présent(s) après traitement`);
          else verifications.push("Aucun terme du dictionnaire ni coordonnée dans le classeur produit");
        }
        const nomFuites = controlerNom(nom, termes, motifs);
        if (nomFuites.length) bloquants.push("Le nom du fichier produit contient un terme");
      } catch (err) {
        bloquants.push(`Échec du traitement : ${String(err)}`);
      }
      produits.push({
        fichierId: f.id,
        pieceCle: f.pieceCle,
        nomSortie: nom,
        octets,
        empreinte: octets.length ? await sha256(octets) : "",
        severite: bloquants.length ? "bloquant" : alertes.length ? "attention" : "ok",
        bilan,
        verifications,
        alertes: [...bloquants, ...alertes],
      });
      maj((y) => ({ ...y, production: { fait: i + 1, total, libelle: "Production des fichiers" }, produits: [...produits] }));
    }
    maj((y) => ({ ...y, production: null }));
  }, [maj, detectionsPage]);

  const actions = useMemo<Actions>(
    () => ({
      e,
      aller: (v) => maj((x) => ({ ...x, vue: v })),
      deposer,
      reinitialiser: () => {
        cacheDetections.current.clear();
        maj(() => ({ ...INITIAL }));
      },
      changerPiece: (fichierId, cle) =>
        maj((x) =>
          recalculerSuggestions(
            synchroniserPieces({ ...x, fichiers: x.fichiers.map((f) => (f.id === fichierId ? { ...f, pieceCle: cle.trim() || f.pieceCle } : f)) }),
          ),
        ),
      exclure: (fichierId) =>
        maj((x) =>
          synchroniserPieces({
            ...x,
            fichiers: x.fichiers.filter((f) => f.id !== fichierId),
            pages: x.pages.filter((p) => p.fichierId !== fichierId),
          }),
        ),
      ajouterTerme: (valeur) =>
        maj((x) => {
          if (!valeur.trim() || x.termes.some((t) => memeValeur(t.valeur, valeur))) return x;
          return recalculerSuggestions({ ...x, termes: attribuerPseudos([...x.termes, creerTerme(valeur, "saisie")], piecesDe(x.fichiers)) });
        }),
      modifierTerme: (id, modif) =>
        maj((x) => ({ ...x, termes: attribuerPseudos(x.termes.map((t) => (t.id === id ? { ...t, ...modif } : t)), piecesDe(x.fichiers)) })),
      supprimerTerme: (id) =>
        maj((x) => recalculerSuggestions({ ...x, termes: attribuerPseudos(x.termes.filter((t) => t.id !== id), piecesDe(x.fichiers)) })),
      accepterSuggestion: (s) =>
        maj((x) =>
          recalculerSuggestions({
            ...x,
            termes: attribuerPseudos([...x.termes, creerTerme(s.valeur, "suggestion")], piecesDe(x.fichiers)),
          }),
        ),
      rejeterSuggestion: (s) => maj((x) => recalculerSuggestions({ ...x, rejetees: [...x.rejetees, s.valeur] })),
      basculerMotif: (m) => maj((x) => ({ ...x, motifs: x.motifs.includes(m) ? x.motifs.filter((y) => y !== m) : [...x.motifs, m] })),
      options: (o) =>
        maj((x) => {
          const options = { ...x.options, ...o };
          let colonnes = x.colonnes;
          if (o.retirerColonnesPrix !== undefined)
            colonnes = Object.fromEntries(
              Object.entries(x.tableurs).map(([id, t]) => [id, Object.fromEntries(t.feuilles.map((fe) => [fe.nom, options.retirerColonnesPrix ? fe.colonnesPrix : []]))]),
            );
          let pages = x.pages;
          if (o.ocrTousLesPlans) pages = x.pages.map((p) => (p.ocrRequis ? p : { ...p, ocrRequis: true }));
          return { ...x, options, colonnes, pages };
        }),
      basculerColonne: (fichierId, feuille, j) =>
        maj((x) => {
          const actuelles = x.colonnes[fichierId]?.[feuille] ?? [];
          const suivantes = actuelles.includes(j) ? actuelles.filter((k) => k !== j) : [...actuelles, j];
          return { ...x, colonnes: { ...x.colonnes, [fichierId]: { ...x.colonnes[fichierId], [feuille]: suivantes } } };
        }),
      majZones: (gabaritId, zones) => maj((x) => ({ ...x, gabarits: x.gabarits.map((g) => (g.id === gabaritId ? { ...g, zones } : g)) })),
      detectionsPage,
      basculerDetection: (pageId, detId) =>
        maj((x) => {
          const et = x.etatsPages[pageId] ?? { retirees: [], manuels: [] };
          const retirees = et.retirees.includes(detId) ? et.retirees.filter((d) => d !== detId) : [...et.retirees, detId];
          return { ...x, etatsPages: { ...x.etatsPages, [pageId]: { ...et, retirees } } };
        }),
      ajouterManuel: (pageId, r) =>
        maj((x) => {
          const et = x.etatsPages[pageId] ?? { retirees: [], manuels: [] };
          return { ...x, etatsPages: { ...x.etatsPages, [pageId]: { ...et, manuels: [...et.manuels, r] } } };
        }),
      retirerManuel: (pageId, i) =>
        maj((x) => {
          const et = x.etatsPages[pageId] ?? { retirees: [], manuels: [] };
          return { ...x, etatsPages: { ...x.etatsPages, [pageId]: { ...et, manuels: et.manuels.filter((_, k) => k !== i) } } };
        }),
      valider: (fichierId, ok) => maj((x) => ({ ...x, valides: { ...x.valides, [fichierId]: ok } })),
      produire,
      lancerOcr: () => void lancerOcr(),
      projet: () => {
        const x = ref.current;
        return JSON.stringify(
          {
            format: "evmasque-projet",
            version: 1,
            termes: x.termes.filter((t) => t.origine !== "piece").map(({ valeur, actif }) => ({ valeur, actif })),
            rejetees: x.rejetees,
            motifs: x.motifs,
            gabarits: x.gabarits.map(({ id, libelle, largeurMm, hauteurMm, zones }) => ({ id, libelle, largeurMm, hauteurMm, zones })),
            options: x.options,
          },
          null,
          2,
        );
      },
      chargerProjet: (json) =>
        maj((x) => {
          const p = JSON.parse(json);
          if (p.format !== "evmasque-projet") throw new Error("Ce fichier n'est pas un projet EvMasque");
          // Les projets plus anciens portent encore une « categorie » par terme : elle est ignorée.
          const ajouts = (p.termes as { valeur: string; actif: boolean }[])
            .filter((t) => !x.termes.some((u) => memeValeur(u.valeur, t.valeur)))
            .map((t) => ({ ...creerTerme(t.valeur, "saisie"), actif: t.actif }));
          const gabarits = [...x.gabarits];
          for (const g of p.gabarits as Gabarit[]) {
            const i = gabarits.findIndex((h) => h.id === g.id);
            if (i >= 0) gabarits[i] = { ...gabarits[i], zones: g.zones };
            else gabarits.push(g);
          }
          return recalculerSuggestions({
            ...x,
            termes: attribuerPseudos([...x.termes, ...ajouts], piecesDe(x.fichiers)),
            rejetees: [...new Set([...x.rejetees, ...(p.rejetees ?? [])])],
            motifs: p.motifs ?? x.motifs,
            gabarits,
            options: { ...x.options, ...p.options },
          });
        }),
    }),
    [e, maj, deposer, detectionsPage, produire, lancerOcr],
  );

  return <Ctx.Provider value={actions}>{children}</Ctx.Provider>;
}
