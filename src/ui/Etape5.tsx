/** Étape 5 : produire le paquet, contrôler, enregistrer sur le poste. */
import { useMemo, useState } from "react";
import { piecesDe, useEv } from "../etat";
import {
  archive,
  choisirDossier,
  ecrireDans,
  ecritureDossierDisponible,
  fichierCollecte,
  motDePasse,
  rapport,
  tableCorrespondance,
  telecharger,
  type Entree,
} from "../lib/livrables";
import { Lien7Zip } from "./Chiffrement";

function horodatage(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;
}

const LISEZ_MOI = `EvMasque · Evolia Stratégie

Ce dossier « A_GARDER » reste chez vous. Il contient :
- table-de-correspondance.xlsx : le lien entre les pseudonymes (P-001, CLIENT-A…) et vos vraies références.
  Il vous permet de relire nos résultats sur vos propres pièces. Ne l'envoyez jamais.
- rapport-anonymisation.html : la copie du rapport joint au paquet envoyé.
- projet-evmasque.json : vos réglages (dictionnaire, zones de cartouche), pour un prochain lot.
  Il contient vos termes d'origine : gardez-le avec la table de correspondance.

Seul le paquet « A_ENVOYER » (ou son archive chiffrée) est destiné à Evolia Stratégie.
`;

export function Etape5() {
  const ev = useEv();
  const { e } = ev;
  const [mdp, setMdp] = useState<string | null>(null);
  const [termine, setTermine] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const pieces = useMemo(() => piecesDe(e.fichiers), [e.fichiers]);
  const fichiers = e.fichiers.filter((f) => f.type !== "ignore");
  const produits = e.produits;
  const complet = produits.length === fichiers.length && !e.production;
  const bloquants = produits.filter((p) => p.severite === "bloquant");
  const attentions = produits.filter((p) => p.severite === "attention");

  const enregistrer = async () => {
    setErreur(null);
    setEnCours(true);
    try {
      const date = new Date();
      const stamp = horodatage(date);
      const rap = new TextEncoder().encode(rapport(produits, e.fichiers, date));
      const pseudoDe = (cle: string) => pieces.find((p) => p.cle === cle)?.pseudo ?? "P-000";
      const aEnvoyer: Entree[] = [
        ...produits.map((p) => ({ chemin: `${pseudoDe(p.pieceCle)}/${p.nomSortie}`, octets: p.octets })),
        { chemin: "fichier-de-collecte.xlsx", octets: fichierCollecte(pieces, e.fichiers, produits) },
        { chemin: "rapport-anonymisation.html", octets: rap },
      ];
      const aGarder: Entree[] = [
        { chemin: "table-de-correspondance.xlsx", octets: tableCorrespondance(pieces, e.termes, e.fichiers, produits) },
        { chemin: "rapport-anonymisation.html", octets: rap },
        { chemin: "projet-evmasque.json", octets: new TextEncoder().encode(ev.projet()) },
        { chemin: "LISEZ-MOI.txt", octets: new TextEncoder().encode(LISEZ_MOI) },
      ];
      const motPasse = e.options.archiveChiffree ? motDePasse() : null;
      const racine = `EvMasque_${stamp}`;

      if (ecritureDossierDisponible()) {
        const dossier = await choisirDossier();
        if (motPasse) await ecrireDans(dossier, `${racine}/A_ENVOYER_chiffre.zip`, await archive(aEnvoyer, motPasse));
        else for (const en of aEnvoyer) await ecrireDans(dossier, `${racine}/A_ENVOYER/${en.chemin}`, en.octets);
        for (const en of aGarder) await ecrireDans(dossier, `${racine}/A_GARDER/${en.chemin}`, en.octets);
        setTermine(`Enregistré dans le dossier « ${dossier.name}/${racine} » de votre poste.`);
      } else {
        telecharger(`${racine}_A_ENVOYER${motPasse ? "_chiffre" : ""}.zip`, await archive(aEnvoyer, motPasse ?? undefined));
        telecharger(`${racine}_A_GARDER.zip`, await archive(aGarder));
        setTermine("Deux archives ont été enregistrées dans le dossier de téléchargement de votre navigateur.");
      }
      setMdp(motPasse);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setErreur(String(err));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <div className="intro">
        <div>
          <span className="libelle">Étape 5 sur 5</span>
          <h1>Envoi</h1>
          <p>
            EvMasque fabrique les fichiers anonymisés, puis les relit pour vérifier qu'il n'y reste rien. Le paquet est
            ensuite enregistré <b>sur votre poste uniquement</b> ; vous l'envoyez à Evolia Stratégie par le moyen de votre choix.
          </p>
        </div>
      </div>

      {!complet && !e.production && (
        <div className="cadre">
          <h3>Avant de produire</h3>
          <p className="petit" style={{ marginTop: 6 }}>
            {fichiers.length} fichier(s) · {pieces.length} pièce(s) · {e.termes.filter((t) => t.actif).length} terme(s) masqué(s) ·
            plans en image à {e.options.dpiSortie} points par pouce
          </p>
          <label className="ligne" style={{ margin: "10px 0 16px" }}>
            <input type="checkbox" checked={e.options.archiveChiffree} onChange={() => ev.options({ archiveChiffree: !e.options.archiveChiffree })} />
            <span>
              Créer une <b>archive chiffrée</b> (AES-256) pour l'envoi, avec un mot de passe à nous donner par téléphone{" "}
              <button className="lien petit" onClick={() => ev.aller("chiffrement")}>
                comment ça marche ?
              </button>
            </span>
          </label>
          <button className="btn" onClick={() => void ev.produire()}>
            Produire et contrôler le paquet
          </button>
        </div>
      )}

      {e.production && (
        <div className="panneau">
          <span className="libelle">
            {e.production.libelle} · {e.production.fait} / {e.production.total}
          </span>
          <div className="barre">
            <i style={{ width: `${(100 * e.production.fait) / Math.max(1, e.production.total)}%` }} />
          </div>
          <p className="petit pale" style={{ margin: "8px 0 0" }}>
            Chaque plan est redessiné en haute définition : comptez quelques secondes par page.
          </p>
        </div>
      )}

      {complet && (
        <>
          {bloquants.length > 0 ? (
            <div className="panneau-danger">
              <b>{bloquants.length} fichier(s) bloqué(s).</b> Le paquet ne peut pas être enregistré tant qu'un fichier est
              bloqué. Revenez à l'étape 4 pour le corriger, ou à l'étape 1 pour le retirer du lot, puis relancez la production.
              <div className="ligne" style={{ marginTop: 10 }}>
                <button className="btn-sec" onClick={() => ev.aller(4)}>
                  Revenir à la retouche plan par plan
                </button>
                <button className="btn-sec" onClick={() => void ev.produire()}>
                  Relancer la production
                </button>
              </div>
            </div>
          ) : (
            !termine && (
              <div className="cadre cadre-ok">
                <h3>
                  <span className="ok">✓</span> Tout est conforme
                  {attentions.length ? `, avec ${attentions.length} point(s) à noter (voir le double contrôle ci-dessous)` : ""}
                </h3>
                <p className="petit" style={{ margin: "6px 0 14px" }}>
                  Vous allez choisir un dossier de votre poste. EvMasque y crée <span className="mono">A_ENVOYER</span>
                  {e.options.archiveChiffree ? " (archive chiffrée)" : ""}, le paquet destiné à Evolia, et{" "}
                  <span className="mono">A_GARDER</span>, qui contient la table de correspondance et{" "}
                  <b className="danger">ne doit jamais être envoyé</b>.
                </p>
                <div className="ligne">
                  <button className="btn btn-ok" onClick={() => void enregistrer()} disabled={enCours}>
                    {enCours ? "Enregistrement…" : "Enregistrer sur mon poste"}
                  </button>
                  <button className="btn-sec" onClick={() => void ev.produire()} disabled={enCours}>
                    Relancer la production
                  </button>
                </div>
              </div>
            )
          )}
        </>
      )}

      {erreur && (
        <div className="panneau-danger" style={{ marginTop: 12 }}>
          {erreur}
        </div>
      )}

      {termine && (
        <div className="cadre cadre-ok">
          <h2>
            <span className="ok">✓</span> Paquet enregistré
          </h2>
          <p style={{ marginTop: 8 }}>{termine}</p>
          {mdp ? (
            <>
              <div className="libelle" style={{ marginTop: 16 }}>
                Mot de passe de l'archive
              </div>
              <div className="mdp" data-testid="mot-de-passe">
                {mdp}
              </div>
              <div className="ligne">
                <button className="btn-sec" onClick={() => void navigator.clipboard?.writeText(mdp)}>
                  Copier
                </button>
                <span className="petit">
                  Notez-le maintenant : il n'est <b>enregistré nulle part</b>, et ne s'affichera plus. C'est lui qui permet
                  d'ouvrir l'archive : sans lui, son contenu est illisible.
                </span>
              </div>
              <div className="espace" />
              <h3>Et maintenant ?</h3>
              <ol className="etapes-num petit">
                <li>
                  <b>Vérifiez l'archive</b> (conseillé) : ouvrez-la avec <b>7-Zip</b>, gratuit (<Lien7Zip />
                  ), clic droit › 7-Zip › Extraire, puis saisissez le mot de passe. Vous verrez exactement ce que nous recevrons.
                </li>
                <li>
                  <b>Envoyez l'archive</b> <span className="mono">A_ENVOYER_chiffre.zip</span> à Evolia Stratégie, par e-mail ou
                  par le service de transfert de votre entreprise.
                </li>
                <li>
                  <b>Donnez-nous le mot de passe par téléphone ou par SMS</b>, jamais dans le même message que l'archive.
                </li>
              </ol>
              <p className="petit" style={{ margin: "8px 0 0" }}>
                <button className="lien" onClick={() => ev.aller("chiffrement")}>
                  Tout savoir sur le chiffrement et l'ouverture de l'archive
                </button>
              </p>
            </>
          ) : (
            <p className="petit pale">Paquet non chiffré : transmettez-le par un moyen sûr.</p>
          )}
          <div className="espace" />
          <div className="panneau petit">
            <b>À envoyer :</b> A_ENVOYER{mdp ? "_chiffre.zip" : ""} · <b>À garder chez vous :</b> A_GARDER (table de
            correspondance, rapport, réglages du projet), <b className="danger">à ne jamais envoyer</b>.
          </div>
        </div>
      )}

      {produits.length > 0 && (
        <>
          <div className="espace" />
          <div className="espace" />
          <h2>Double contrôle</h2>
          <p className="pale petit" style={{ margin: "4px 0 12px" }}>
            Chaque fichier produit a été relu comme le ferait un tiers.
          </p>
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 230 }}>Fichier produit</th>
                <th style={{ width: 110 }}>Résultat</th>
                <th>Traitement</th>
                <th>Contrôles</th>
              </tr>
            </thead>
            <tbody>
              {produits.map((p) => (
                <tr key={p.fichierId}>
                  <td className="mono petit">{p.nomSortie}</td>
                  <td>
                    <span className={`puce ${p.severite}`}>{p.severite === "ok" ? "Conforme" : p.severite === "attention" ? "À noter" : "Bloqué"}</span>
                  </td>
                  <td className="petit">
                    {p.bilan.map((b, i) => (
                      <div key={i}>{b}</div>
                    ))}
                  </td>
                  <td className="petit">
                    {p.verifications.map((v, i) => (
                      <div key={i}>
                        <span className="ok">✓</span> {v}
                      </div>
                    ))}
                    {p.alertes.map((a, i) => (
                      <div key={`a${i}`} className="alerte">
                        ⚠ {a}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
