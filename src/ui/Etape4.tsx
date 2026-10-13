/** Étape 4 : retouche et vérification, fichier par fichier, et validation explicite. */
import { useMemo, useState } from "react";
import { piecesDe, nomSortie, useEv } from "../etat";
import { LIBELLES_TYPES } from "../lib/inventaire";
import { termesActifs } from "../lib/masquage";
import { anonymiserStep, verifierIntegrite } from "../lib/step";
import { anonymiserTableur } from "../lib/tableur";
import type { Fichier } from "../lib/types";
import { Apercu, type RectAffiche } from "./Apercu";

export function Etape4() {
  const ev = useEv();
  const { e } = ev;
  const fichiers = e.fichiers.filter((f) => f.type !== "ignore");
  const [choisi, setChoisi] = useState(fichiers[0]?.id ?? "");
  const f = fichiers.find((x) => x.id === choisi) ?? fichiers[0];
  const nbValides = fichiers.filter((x) => e.valides[x.id]).length;
  const pieces = useMemo(() => piecesDe(e.fichiers), [e.fichiers]);

  const suivant = () => {
    const i = fichiers.findIndex((x) => x.id === f?.id);
    const prochain = fichiers.slice(i + 1).find((x) => !e.valides[x.id]) ?? fichiers.find((x) => !e.valides[x.id] && x.id !== f?.id);
    if (prochain) setChoisi(prochain.id);
  };

  return (
    <>
      <div className="intro">
        <div>
          <span className="libelle">Étape 4 sur 5</span>
          <h1>Retouche plan par plan</h1>
          <p>
            La zone commune et les termes du dictionnaire sont déjà masqués. Reste ce qui est propre à chaque plan, et
            presque chaque plan en a : <b>cliquez-glissez</b> pour masquer un nom, une référence ou une adresse oubliés,{" "}
            <b>cliquez sur un masque</b> pour le retirer s'il cache une cote utile, puis <b>validez</b> le fichier.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="libelle" style={{ marginBottom: 8 }}>
            {nbValides} / {fichiers.length} fichier(s) validé(s)
          </div>
          <button className="btn" onClick={() => ev.aller(5)} disabled={nbValides < fichiers.length || !!e.ocr}>
            Continuer
          </button>
        </div>
      </div>
      {e.ocr && (
        <div className="panneau" style={{ marginBottom: 16 }}>
          <span className="libelle">
            {e.ocr.libelle} · {e.ocr.fait} / {e.ocr.total}
          </span>
          <div className="barre">
            <i style={{ width: `${(100 * e.ocr.fait) / Math.max(1, e.ocr.total)}%` }} />
          </div>
        </div>
      )}

      <div className="verif">
        <div className="liste-fichiers">
          {fichiers.map((x) => {
            const pp = e.pages.filter((p) => p.fichierId === x.id);
            const enAttente = pp.some((p) => p.ocrRequis && p.segmentsOcr === null);
            return (
              <button key={x.id} className={x.id === f?.id ? "actif" : ""} onClick={() => setChoisi(x.id)}>
                <span className="nom" title={x.chemin}>
                  {x.nom}
                </span>
                <span>
                  {e.valides[x.id] ? <span className="puce ok">Validé</span> : enAttente ? <span className="puce attention">Lecture…</span> : null}
                </span>
                <span className="pale petit">
                  {LIBELLES_TYPES[x.type]}
                  {pp.length ? ` · ${pp.length} p.` : ""}
                </span>
                <span className="mono petit pale">{nomSortie(x, fichiers, pieces)}</span>
              </button>
            );
          })}
        </div>

        {f && (f.type === "pdf" || f.type === "tif" || f.type === "image") && <VerifPlan key={f.id} f={f} onValider={suivant} />}
        {f && f.type === "step" && <VerifStep key={f.id} f={f} onValider={suivant} />}
        {f && f.type === "tableur" && <VerifTableur key={f.id} f={f} onValider={suivant} />}
      </div>
    </>
  );
}

function BoutonValider({ f, onValider, compact = false }: { f: Fichier; onValider: () => void; compact?: boolean }) {
  const ev = useEv();
  const ok = ev.e.valides[f.id];
  return ok ? (
    <div className="ligne">
      <span className="puce ok">Validé</span>
      <button className="lien-pale" onClick={() => ev.valider(f.id, false)}>
        Annuler la validation
      </button>
    </div>
  ) : (
    <button
      className="btn btn-ok"
      style={compact ? undefined : { width: "100%" }}
      onClick={() => {
        ev.valider(f.id, true);
        onValider();
      }}
    >
      Valider ce fichier
    </button>
  );
}

function VerifPlan({ f, onValider }: { f: Fichier; onValider: () => void }) {
  const ev = useEv();
  const { e } = ev;
  const pages = e.pages.filter((p) => p.fichierId === f.id).sort((a, b) => a.index - b.index);
  const [i, setI] = useState(0);
  const [avant, setAvant] = useState(false);
  const page = pages[Math.min(i, pages.length - 1)];
  if (!page) return <div className="panneau">Lecture du fichier en cours…</div>;
  const detections = ev.detectionsPage(page);
  const etat = e.etatsPages[page.id] ?? { retirees: [], manuels: [] };
  const retirees = new Set(etat.retirees);
  const enAttente = page.ocrRequis && page.segmentsOcr === null;

  const rects: RectAffiche[] = [
    ...detections.map((d) => ({
      ...d,
      cle: d.id,
      classe: retirees.has(d.id) ? ("retire" as const) : d.origine,
      titre: `${d.libelle} · cliquer pour ${retirees.has(d.id) ? "masquer à nouveau" : "laisser visible"}`,
      onClic: () => ev.basculerDetection(page.id, d.id),
    })),
    ...etat.manuels.map((m, k) => ({ ...m, cle: `m${k}`, classe: "manuel" as const, titre: "Ajout manuel", onRetirer: () => ev.retirerManuel(page.id, k) })),
  ];

  return (
    <>
      <div>
        <div className="ligne" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div className="ligne">
            <button className="btn-sec" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
              ‹
            </button>
            <span className="mono petit">
              Page {page.index + 1} / {pages.length}
            </span>
            <button className="btn-sec" onClick={() => setI((x) => Math.min(pages.length - 1, x + 1))} disabled={i >= pages.length - 1}>
              ›
            </button>
          </div>
          <div className="ligne">
            <button className={avant ? "btn-sec" : "btn"} onClick={() => setAvant(false)}>
              Après
            </button>
            <button className={avant ? "btn" : "btn-sec"} onClick={() => setAvant(true)}>
              Avant
            </button>
            <span className="separateur" />
            <BoutonValider f={f} onValider={onValider} compact />
          </div>
        </div>
        {enAttente && <div className="panneau-alerte" style={{ marginBottom: 10 }}>Cette page est en cours de lecture par l'OCR : les textes trouvés apparaîtront dans un instant.</div>}
        <Apercu fichier={f} page={page} rects={rects} avant={avant} hauteurMax="74vh" onTrace={avant ? undefined : (r) => ev.ajouterManuel(page.id, r)} />
      </div>
      <div className="colonne-droite">
        <h3>Ce qui est masqué sur cette page</h3>
        <p className="pale petit" style={{ marginTop: 4 }}>
          {page.ocrRequis ? "Texte lu par OCR" : "Texte lu dans le PDF"} · {page.segmentsTexte.length + (page.segmentsOcr?.length ?? 0)} élément(s) de texte
        </p>
        {detections.length === 0 && etat.manuels.length === 0 && <div className="panneau petit">Rien n'est masqué sur cette page.</div>}
        {detections.map((d) => (
          <label key={d.id} className="det petit">
            <input type="checkbox" checked={!retirees.has(d.id)} onChange={() => ev.basculerDetection(page.id, d.id)} />
            <span>
              <b style={{ color: "var(--encre)", fontWeight: 500 }}>{d.libelle}</b>
              <br />
              <span className="pale">{d.origine === "zone" ? "Zone commune (étape 3)" : d.origine === "terme" ? "Terme du dictionnaire" : "Coordonnée"}</span>
            </span>
          </label>
        ))}
        {etat.manuels.map((_, k) => (
          <div key={k} className="det petit">
            <span>✎</span>
            <span>
              Ajout manuel{" "}
              <button className="lien-pale" onClick={() => ev.retirerManuel(page.id, k)}>
                retirer
              </button>
            </span>
          </div>
        ))}
        {retirees.size > 0 && (
          <div className="panneau-alerte petit" style={{ marginTop: 12 }}>
            {retirees.size} élément(s) laissé(s) visible(s) à votre demande. Ce choix figurera dans le rapport.
          </div>
        )}
      </div>
    </>
  );
}

function VerifStep({ f, onValider }: { f: Fichier; onValider: () => void }) {
  const { e } = useEv();
  const pieces = piecesDe(e.fichiers);
  const res = useMemo(() => {
    const source = e.steps[f.id] ?? "";
    const pseudo = pieces.find((p) => p.cle === f.pieceCle)?.pseudo ?? "P-000";
    const r = anonymiserStep(source, termesActifs(e.termes), e.motifs, pseudo, nomSortie(f, e.fichiers, pieces));
    return { r, integ: verifierIntegrite(source, r.texte) };
  }, [f, e.steps, e.termes, e.motifs, e.fichiers, pieces]);
  return (
    <>
      <div>
        <h2>{f.nom}</h2>
        <p className="pale">
          La géométrie n'est pas modifiée. Seuls les textes d'identification sont réécrits : en-tête du fichier, nom du
          produit, auteurs, organisations, chemins d'accès, commentaires.
        </p>
        <div className={res.integ.ok ? "panneau panneau-ok" : "panneau-alerte"} style={{ marginBottom: 14 }}>
          <b>{res.integ.ok ? "✓ Intégrité vérifiée" : "Intégrité non vérifiée"}</b> · {res.integ.message}
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Avant</th>
              <th style={{ width: 220 }}>Après</th>
            </tr>
          </thead>
          <tbody>
            {res.r.remplacements.slice(0, 200).map((x, k) => (
              <tr key={k}>
                <td className="mono petit" style={{ wordBreak: "break-all" }}>
                  {x.de}
                </td>
                <td className="mono petit">{x.vers}</td>
              </tr>
            ))}
            {res.r.remplacements.length === 0 && (
              <tr>
                <td colSpan={2} className="pale">
                  Aucun texte d'identification trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="pale petit" style={{ marginTop: 8 }}>
          {res.r.commentairesRetires} commentaire(s) retiré(s) en plus des remplacements ci-dessus.
        </p>
      </div>
      <div className="colonne-droite">
        <BoutonValider f={f} onValider={onValider} />
      </div>
    </>
  );
}

function VerifTableur({ f, onValider }: { f: Fichier; onValider: () => void }) {
  const { e } = useEv();
  const analyse = e.tableurs[f.id];
  const res = useMemo(
    () =>
      analyse
        ? anonymiserTableur(analyse, f.extension, termesActifs(e.termes), e.motifs, {
            inclureMasquees: e.options.inclureFeuillesMasquees,
            colonnesRetirees: e.colonnes[f.id] ?? {},
          })
        : null,
    [analyse, f.extension, e.termes, e.motifs, e.options.inclureFeuillesMasquees, e.colonnes, f.id],
  );
  if (!res) return <div className="panneau">Lecture du tableur en cours…</div>;
  const remplacementsUniques = [...new Map(res.remplacements.map((r) => [r.de + "→" + r.vers, r])).values()];
  return (
    <>
      <div>
        <h2>{f.nom}</h2>
        <p className="pale">
          Le classeur est reconstruit à neuf avec les valeurs seules : propriétés du document, commentaires, images,
          liens externes et formules ne sont pas recopiés.
        </p>
        <div className="grille-2" style={{ gap: 14, marginBottom: 14 }}>
          <div className="panneau petit">
            <b>{res.colonnesRetirees.length}</b> colonne(s) de prix retirée(s)
            {res.colonnesRetirees.length > 0 && <div className="pale">{res.colonnesRetirees.join(" · ")}</div>}
          </div>
          <div className="panneau petit">
            <b>{res.feuillesRetirees.length}</b> feuille(s) masquée(s) écartée(s)
            {res.feuillesRetirees.length > 0 && <div className="pale">{res.feuillesRetirees.join(" · ")}</div>}
          </div>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>Avant</th>
              <th style={{ width: 220 }}>Après</th>
            </tr>
          </thead>
          <tbody>
            {remplacementsUniques.slice(0, 200).map((x, k) => (
              <tr key={k}>
                <td className="petit">{x.de}</td>
                <td className="mono petit">{x.vers}</td>
              </tr>
            ))}
            {remplacementsUniques.length === 0 && (
              <tr>
                <td colSpan={2} className="pale">
                  Aucune valeur du dictionnaire trouvée dans les cellules.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="colonne-droite">
        <BoutonValider f={f} onValider={onValider} />
      </div>
    </>
  );
}
