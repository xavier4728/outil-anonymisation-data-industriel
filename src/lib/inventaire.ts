/** Inventaire des fichiers déposés : type, et regroupement par pièce. */
import { nouvelId } from "./dictionnaire";
import type { Fichier, TypeFichier } from "./types";

const TYPES: Record<string, TypeFichier> = {
  pdf: "pdf",
  tif: "tif",
  tiff: "tif",
  jpg: "image",
  jpeg: "image",
  png: "image",
  step: "step",
  stp: "step",
  p21: "step",
  xlsx: "tableur",
  xlsm: "tableur",
  xls: "tableur",
  ods: "tableur",
  csv: "tableur",
};

export const LIBELLES_TYPES: Record<TypeFichier, string> = {
  pdf: "Plan PDF",
  tif: "Plan TIF",
  image: "Image",
  step: "Fichier 3D (STEP)",
  tableur: "Tableur",
  ignore: "Non traité",
};

export function extension(nom: string): string {
  const i = nom.lastIndexOf(".");
  return i === -1 ? "" : nom.slice(i + 1).toLowerCase();
}

export function typeDe(nom: string): TypeFichier {
  return TYPES[extension(nom)] ?? "ignore";
}

/** Mots de rôle qui accompagnent souvent la référence dans un nom de fichier. */
const MOTS_ROLE =
  /^(plan|plans|etude|étude|study|step|stp|3d|2d|temps|times|devis|offre|chiffrage|gamme|ind|indice|rev|revision|rév|version|v\d+|ind[a-z]?|scan|copie|copy|final|def|définitif|definitif)$/i;

/** Clé de pièce tirée d'un nom de fichier : le premier mot significatif. */
export function cleDepuisNom(nom: string): string {
  const base = nom.replace(/\.[^.]+$/, "");
  const mots = base.split(/[\s_]+/).filter((m) => m && !MOTS_ROLE.test(m));
  return (mots[0] ?? base).trim() || base;
}

/**
 * Clé de pièce d'un fichier. Si les pièces sont rangées en sous-dossiers, le sous-dossier fait foi ;
 * sinon on prend le début du nom de fichier.
 */
export function clePiece(cheminRelatif: string): string {
  const parties = cheminRelatif.split(/[\\/]/).filter(Boolean);
  // parties[0] = dossier déposé, dernier = nom du fichier
  if (parties.length >= 3) return parties[1];
  return cleDepuisNom(parties[parties.length - 1]);
}

export function creerFichier(file: File, cheminRelatif: string): Fichier {
  const chemin = cheminRelatif || file.name;
  return {
    id: nouvelId("f"),
    chemin,
    nom: file.name,
    extension: extension(file.name),
    type: typeDe(file.name),
    taille: file.size,
    file,
    pieceCle: clePiece(chemin.includes("/") || chemin.includes("\\") ? chemin : `racine/${chemin}`),
  };
}

/** Lit récursivement un dossier déposé par glisser-déposer. */
export async function lireDepot(items: DataTransferItemList): Promise<{ file: File; chemin: string }[]> {
  const entrees: FileSystemEntry[] = [];
  for (const item of Array.from(items)) {
    const e = item.webkitGetAsEntry?.();
    if (e) entrees.push(e);
  }
  const out: { file: File; chemin: string }[] = [];
  const parcourir = async (e: FileSystemEntry, chemin: string): Promise<void> => {
    if (e.isFile) {
      const file = await new Promise<File>((ok, ko) => (e as FileSystemFileEntry).file(ok, ko));
      out.push({ file, chemin: `${chemin}${file.name}` });
    } else if (e.isDirectory) {
      const lecteur = (e as FileSystemDirectoryEntry).createReader();
      let lot: FileSystemEntry[];
      do {
        lot = await new Promise<FileSystemEntry[]>((ok, ko) => lecteur.readEntries(ok, ko));
        for (const enfant of lot) await parcourir(enfant, `${chemin}${e.name}/`);
      } while (lot.length);
    }
  };
  for (const e of entrees) await parcourir(e, "");
  return out;
}

/** Références candidates trouvées dans les noms de fichiers et de dossiers. */
export function referencesDansLesNoms(fichiers: Fichier[]): string[] {
  const out = new Set<string>();
  for (const f of fichiers) {
    out.add(f.pieceCle);
    for (const m of f.chemin.matchAll(/[A-Za-z0-9][A-Za-z0-9.-]{3,}[A-Za-z0-9]/g)) {
      const v = m[0];
      if (/\d/.test(v) && /[A-Za-z0-9]{2,}/.test(v) && !/^\d{1,4}$/.test(v) && !/^(pdf|step|stp|xlsx|tif|tiff|png|jpe?g|csv)$/i.test(v))
        out.add(v.replace(/\.(pdf|step|stp|xlsx?|tiff?|png|jpe?g|csv)$/i, ""));
    }
  }
  return [...out].filter((r) => r.length >= 4);
}

/** Rôle d'un fichier dans le paquet de sortie, pour le nommer. */
export function roleSortie(type: TypeFichier): string {
  switch (type) {
    case "pdf":
    case "tif":
    case "image":
      return "plan";
    case "step":
      return "3d";
    case "tableur":
      return "tableur";
    default:
      return "fichier";
  }
}

export function extensionSortie(f: Fichier): string {
  if (f.type === "pdf" || f.type === "tif" || f.type === "image") return "pdf";
  if (f.type === "step") return f.extension === "stp" ? "stp" : "step";
  if (f.type === "tableur") return f.extension === "csv" ? "csv" : "xlsx";
  return f.extension;
}

export function octetsLisibles(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}
