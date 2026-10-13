/**
 * Déchiffre une archive ZIP au standard WinZip AES-256, sans utiliser zip.js (la bibliothèque
 * qui l'a produite) : seulement le module `crypto` de Node. Si ce script ouvre l'archive,
 * 7-Zip et WinZip l'ouvriront aussi.
 *
 *   node tests/e2e/dechiffrer.mjs <archive.zip> <mot de passe> <dossier de sortie>
 */
import { createCipheriv, createHmac, pbkdf2Sync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const [, , archive, motDePasse, sortie] = process.argv;
const buf = readFileSync(archive);

function fluxAesCtrWinZip(cle, n) {
  // WinZip AES : mode CTR, compteur de 128 bits en petit-boutiste, qui commence à 1.
  const blocs = Math.ceil(n / 16);
  const compteurs = Buffer.alloc(blocs * 16);
  for (let i = 0; i < blocs; i++) compteurs.writeBigUInt64LE(BigInt(i + 1), i * 16);
  const c = createCipheriv("aes-256-ecb", cle, null);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(compteurs), c.final()]).subarray(0, n);
}

let eocd = buf.length - 22;
while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
if (eocd < 0) throw new Error("Fin de répertoire central introuvable");
const nb = buf.readUInt16LE(eocd + 10);
let p = buf.readUInt32LE(eocd + 16);

const bilan = [];
for (let k = 0; k < nb; k++) {
  if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Répertoire central invalide");
  const methode = buf.readUInt16LE(p + 10);
  const tailleComp = buf.readUInt32LE(p + 20);
  const lnom = buf.readUInt16LE(p + 28);
  const lextra = buf.readUInt16LE(p + 30);
  const lcom = buf.readUInt16LE(p + 32);
  const offLocal = buf.readUInt32LE(p + 42);
  const nom = buf.subarray(p + 46, p + 46 + lnom).toString("utf8");
  const extra = buf.subarray(p + 46 + lnom, p + 46 + lnom + lextra);
  p += 46 + lnom + lextra + lcom;
  if (nom.endsWith("/")) continue;

  let methodeReelle = methode;
  let force = 0;
  for (let e = 0; e + 4 <= extra.length; ) {
    const id = extra.readUInt16LE(e);
    const l = extra.readUInt16LE(e + 2);
    if (id === 0x9901) {
      force = extra.readUInt8(e + 8);
      methodeReelle = extra.readUInt16LE(e + 9);
    }
    e += 4 + l;
  }
  if (methode !== 99 || force !== 3) throw new Error(`${nom} : pas chiffré en AES-256 (méthode ${methode}, force ${force})`);

  const debut = offLocal + 30 + buf.readUInt16LE(offLocal + 26) + buf.readUInt16LE(offLocal + 28);
  const donnees = buf.subarray(debut, debut + tailleComp);
  const sel = donnees.subarray(0, 16);
  const verif = donnees.subarray(16, 18);
  const chiffre = donnees.subarray(18, donnees.length - 10);
  const auth = donnees.subarray(donnees.length - 10);

  const derive = pbkdf2Sync(Buffer.from(motDePasse, "utf8"), sel, 1000, 66, "sha1");
  if (!timingSafeEqual(derive.subarray(64, 66), verif)) throw new Error(`${nom} : mot de passe refusé`);
  const mac = createHmac("sha1", derive.subarray(32, 64)).update(chiffre).digest().subarray(0, 10);
  if (!timingSafeEqual(mac, auth)) throw new Error(`${nom} : code d'authentification invalide`);

  const flux = fluxAesCtrWinZip(derive.subarray(0, 32), chiffre.length);
  const clair = Buffer.alloc(chiffre.length);
  for (let i = 0; i < chiffre.length; i++) clair[i] = chiffre[i] ^ flux[i];
  const contenu = methodeReelle === 8 ? inflateRawSync(clair) : clair;

  const dest = join(sortie, nom);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, contenu);
  bilan.push(`${nom} (${contenu.length} o)`);
}
console.log(`AES-256 conforme WinZip, authentifié : ${bilan.length} fichier(s)`);
for (const b of bilan) console.log("  ·", b);
