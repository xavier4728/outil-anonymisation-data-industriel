/**
 * Les livrables : table de correspondance (à garder), fichier de collecte et rapport (à envoyer),
 * archive chiffrée. Tout est écrit sur le poste de l'utilisateur, nulle part ailleurs.
 */
import * as XLSX from "xlsx";
import { BlobWriter, Uint8ArrayReader, ZipWriter, configure } from "@zip.js/zip.js";
import { LIBELLES_ORIGINES } from "./dictionnaire";
import { LIBELLES_TYPES } from "./inventaire";
import type { Fichier, Piece, Severite, Terme } from "./types";

configure({ useWebWorkers: false });

export const VERSION = "1.1.0";

export interface FichierProduit {
  fichierId: string;
  pieceCle: string;
  nomSortie: string;
  octets: Uint8Array;
  empreinte: string;
  severite: Severite;
  /** Ce qui a été fait, sans aucune valeur d'origine. */
  bilan: string[];
  verifications: string[];
  alertes: string[];
}

function classeur(feuilles: [string, unknown[][]][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: "", Author: "EvMasque", Company: "" };
  for (const [nom, lignes] of feuilles) {
    const ws = XLSX.utils.aoa_to_sheet(lignes);
    ws["!cols"] = (lignes[0] ?? []).map((_, j) => ({ wch: Math.min(60, Math.max(12, ...lignes.map((l) => String(l[j] ?? "").length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, nom);
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** Table de correspondance : la seule pièce qui relie les pseudonymes aux vraies valeurs. Elle ne part jamais. */
export function tableCorrespondance(pieces: Piece[], termes: Terme[], fichiers: Fichier[], produits: FichierProduit[]): Uint8Array {
  const parFichier = new Map(produits.map((p) => [p.fichierId, p.nomSortie]));
  return classeur([
    [
      "Pièces",
      [
        ["Pseudonyme", "Pièce d'origine", "Fichier d'origine", "Fichier produit"],
        ...fichiers
          .filter((f) => parFichier.has(f.id))
          .map((f) => [pieces.find((p) => p.cle === f.pieceCle)?.pseudo ?? "", f.pieceCle, f.chemin, parFichier.get(f.id) ?? ""]),
      ],
    ],
    [
      "Termes",
      [
        ["Pseudonyme", "Valeur d'origine", "Origine", "Utilisé"],
        ...termes.map((t) => [t.pseudo, t.valeur, LIBELLES_ORIGINES[t.origine], t.actif ? "oui" : "non"]),
      ],
    ],
    [
      "À lire",
      [
        ["Ce fichier reste chez vous."],
        ["Il relie les pseudonymes (P-001, MASQUE-001…) aux vraies références et aux vrais noms."],
        ["Il ne fait pas partie du paquet à envoyer, et ne doit jamais l'être."],
        ["Il vous permet de relire les résultats d'Evolia Stratégie sur vos propres pièces."],
      ],
    ],
  ]);
}

/** Fichier de collecte : une ligne par pièce, prérempli. Contrat d'entrée de l'import dans l'outil de devis. */
export function fichierCollecte(pieces: Piece[], fichiers: Fichier[], produits: FichierProduit[]): Uint8Array {
  const parFichier = new Map(produits.map((p) => [p.fichierId, p]));
  const lignes: unknown[][] = [
    [
      "Pièce", "Plan(s)", "Fichier 3D", "Étude / tableur", "Matière", "Quantité ou taille de lot",
      "Machine(s)", "Temps réels disponibles (oui / non)", "Remarques",
    ],
  ];
  for (const p of pieces) {
    const sorties = fichiers.filter((f) => f.pieceCle === p.cle).map((f) => ({ f, s: parFichier.get(f.id) })).filter((x) => x.s);
    if (!sorties.length) continue;
    const noms = (types: string[]) => sorties.filter((x) => types.includes(x.f.type)).map((x) => x.s!.nomSortie).join(", ");
    lignes.push([p.pseudo, noms(["pdf", "tif", "image"]), noms(["step"]), noms(["tableur"]), "", "", "", "", ""]);
  }
  return classeur([
    ["Pièces", lignes],
    [
      "Essai",
      [
        ["Rubrique", "À compléter"],
        ["Famille de pièces retenue pour l'essai", ""],
        ["Contact pour nos questions éventuelles (nom, e-mail)", ""],
        ["Remarques", ""],
      ],
    ],
    [
      "Consignes",
      [
        ["Comment remplir ce fichier"],
        ["Une ligne par pièce. Les colonnes « Plan(s) », « Fichier 3D » et « Étude » sont déjà remplies par EvMasque."],
        ["Complétez la matière, la quantité chiffrée, les machines utilisées et si vous disposez des temps réels."],
        ["N'y écrivez ni nom de client, ni référence d'origine : utilisez les pseudonymes (P-001…)."],
        ["Exemple : P-001 | P-001_plan.pdf | P-001_3d.step | P-001_tableur.xlsx | 42CrMo4 | 5 000 | Tornos DT26 | oui | 2 opérations"],
      ],
    ],
  ]);
}

const ECHAPPER: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const e = (s: string) => s.replace(/[&<>"]/g, (c) => ECHAPPER[c]);

/** Rapport d'anonymisation. Il part avec les fichiers : il ne contient aucune valeur d'origine. */
export function rapport(produits: FichierProduit[], fichiers: Fichier[], date: Date): string {
  const type = (id: string) => LIBELLES_TYPES[fichiers.find((f) => f.id === id)?.type ?? "ignore"];
  const lignes = produits
    .map(
      (p) => `<tr>
  <td class="m">${e(p.nomSortie)}</td><td>${e(type(p.fichierId))}</td>
  <td>${p.bilan.map(e).join("<br>")}</td>
  <td>${[...p.verifications.map((v) => `✓ ${e(v)}`), ...p.alertes.map((a) => `⚠ ${e(a)}`)].join("<br>")}</td>
  <td class="m petit">${p.empreinte}</td></tr>`,
    )
    .join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport d'anonymisation</title>
<style>
body{font:13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f1f1f;margin:32px;max-width:1200px}
h1{font-size:22px;margin:0 0 4px}.sous{color:#6a6a6a;margin:0 0 24px}
table{border-collapse:collapse;width:100%}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid #e4e4e4}
th{font:600 11px/1.3 ui-monospace,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#6a6a6a;border-bottom:1px solid #0a0a0a}
.m{font-family:ui-monospace,Consolas,monospace}.petit{font-size:10px;word-break:break-all;color:#6a6a6a;max-width:220px}
.encart{background:#f2f2f2;border-left:2px solid #0a0a0a;padding:12px 16px;margin:0 0 24px}
</style></head><body>
<h1>Rapport d'anonymisation</h1>
<p class="sous">EvMasque ${VERSION} · Evolia Stratégie · ${date.toLocaleString("fr-FR")}</p>
<div class="encart">Ce rapport accompagne les fichiers anonymisés. Il ne contient <b>aucune valeur d'origine</b> :
ni nom de client, ni référence, ni nom de fichier d'origine. Les empreintes SHA-256 permettent de vérifier
que chaque fichier reçu est bien celui qui a été produit.</div>
<table><thead><tr><th>Fichier produit</th><th>Type</th><th>Traitement</th><th>Contrôles</th><th>Empreinte SHA-256</th></tr></thead>
<tbody>
${lignes}
</tbody></table>
</body></html>`;
}

/* ------------------------------------------------------------ mot de passe */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Mot de passe facile à dicter au téléphone : 5 groupes de 4 caractères sans ambiguïté (≈ 100 bits). */
export function motDePasse(): string {
  const octets = crypto.getRandomValues(new Uint8Array(20));
  const car = [...octets].map((b) => ALPHABET[b % ALPHABET.length]);
  return [0, 4, 8, 12, 16].map((i) => car.slice(i, i + 4).join("")).join("-");
}

/* ---------------------------------------------------------------- archives */

export interface Entree {
  chemin: string;
  octets: Uint8Array;
}

export async function archive(entrees: Entree[], motDePasseArchive?: string): Promise<Blob> {
  const zip = new ZipWriter(new BlobWriter("application/zip"), {
    ...(motDePasseArchive ? { password: motDePasseArchive, encryptionStrength: 3 as const } : {}),
    level: 6,
  });
  for (const en of entrees) await zip.add(en.chemin, new Uint8ArrayReader(en.octets));
  return zip.close();
}

/* ---------------------------------------------------------------- écriture */

type DossierNatif = FileSystemDirectoryHandle;

export function ecritureDossierDisponible(): boolean {
  return typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
}

export async function choisirDossier(): Promise<DossierNatif> {
  return (window as unknown as { showDirectoryPicker: (o: object) => Promise<DossierNatif> }).showDirectoryPicker({
    mode: "readwrite",
    id: "evmasque",
  });
}

export async function ecrireDans(racine: DossierNatif, chemin: string, donnees: Uint8Array | Blob): Promise<void> {
  const parties = chemin.split("/");
  let dossier = racine;
  for (const p of parties.slice(0, -1)) dossier = await dossier.getDirectoryHandle(p, { create: true });
  const fichier = await dossier.getFileHandle(parties[parties.length - 1], { create: true });
  const flux = await fichier.createWritable();
  await flux.write(donnees instanceof Blob ? donnees : new Blob([donnees.slice()]));
  await flux.close();
}

export function telecharger(nom: string, donnees: Blob): void {
  const url = URL.createObjectURL(donnees);
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
