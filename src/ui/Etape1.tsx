/** Étape 1 : déposer les fichiers, vérifier leur regroupement par pièce. */
import { useMemo, useRef, useState } from "react";
import { piecesDe, useEv } from "../etat";
import { LIBELLES_TYPES, lireDepot, octetsLisibles } from "../lib/inventaire";

export function Etape1() {
  const { e, deposer, changerPiece, exclure, aller, chargerProjet } = useEv();
  const [survol, setSurvol] = useState(false);
  const inputDossier = useRef<HTMLInputElement>(null);
  const inputFichiers = useRef<HTMLInputElement>(null);
  const inputProjet = useRef<HTMLInputElement>(null);
  const [erreurProjet, setErreurProjet] = useState<string | null>(null);
  const pieces = useMemo(() => piecesDe(e.fichiers), [e.fichiers]);
  const traites = e.fichiers.filter((f) => f.type !== "ignore");
  const ignores = e.fichiers.filter((f) => f.type === "ignore");

  const depuisInput = (liste: FileList | null) => {
    if (!liste) return;
    void deposer(Array.from(liste).map((file) => ({ file, chemin: file.webkitRelativePath || file.name })));
  };

  return (
    <>
      <div className="intro">
        <div>
          <span className="libelle">Étape 1 sur 5</span>
          <h1>Vos fichiers</h1>
          <p>
            Ajoutez un seul plan, quelques fichiers ou un dossier complet : plans PDF ou TIF, images, fichiers STEP, études
            Excel, exports de temps. Les fichiers sont lus <b>dans cet onglet</b>, sur votre poste : ils ne sont envoyés nulle
            part. Vous pouvez en ajouter plusieurs fois.
          </p>
        </div>
        {traites.length > 0 && (
          <button className="btn" onClick={() => aller(2)} disabled={!!e.analyse}>
            Continuer
          </button>
        )}
      </div>

      <div
        className={`depot${survol ? " survol" : ""}`}
        onDragOver={(ev) => {
          ev.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={async (ev) => {
          ev.preventDefault();
          setSurvol(false);
          const entrees = await lireDepot(ev.dataTransfer.items);
          void deposer(entrees);
        }}
        onClick={() => inputFichiers.current?.click()}
      >
        <h2>Glissez ici un plan, des fichiers ou un dossier</h2>
        <p className="pale">
          ou choisissez-les ci-dessous. Pour plusieurs pièces, un sous-dossier par pièce est l'idéal, mais pas obligatoire.
        </p>
        <div className="ligne" style={{ justifyContent: "center", marginTop: 14 }}>
          <button
            className="btn"
            onClick={(ev) => {
              ev.stopPropagation();
              inputFichiers.current?.click();
            }}
          >
            Choisir un ou plusieurs fichiers
          </button>
          <button
            className="btn-sec"
            onClick={(ev) => {
              ev.stopPropagation();
              inputDossier.current?.click();
            }}
          >
            Choisir un dossier
          </button>
        </div>
        <input
          ref={inputDossier}
          type="file"
          hidden
          multiple
          data-testid="choisir-dossier"
          // @ts-expect-error attribut non standard, reconnu par Chrome, Edge et Firefox
          webkitdirectory=""
          onChange={(ev) => {
            depuisInput(ev.target.files);
            ev.target.value = "";
          }}
        />
        <input
          ref={inputFichiers}
          type="file"
          hidden
          multiple
          data-testid="choisir-fichiers"
          onChange={(ev) => {
            depuisInput(ev.target.files);
            ev.target.value = "";
          }}
        />
      </div>

      {e.analyse && (
        <div style={{ marginTop: 16 }}>
          <span className="libelle">
            {e.analyse.libelle} · {e.analyse.fait} / {e.analyse.total}
          </span>
          <div className="barre">
            <i style={{ width: `${(100 * e.analyse.fait) / Math.max(1, e.analyse.total)}%` }} />
          </div>
        </div>
      )}

      {traites.length > 0 && (
        <>
          <div className="espace" />
          <div className="ligne" style={{ justifyContent: "space-between" }}>
            <h2>
              {pieces.length} pièce{pieces.length > 1 ? "s" : ""} · {traites.length} fichier{traites.length > 1 ? "s" : ""}
            </h2>
            <span className="pale petit">
              Le regroupement vient des sous-dossiers ou du début des noms de fichiers. Corrigez la pièce d'un fichier si besoin.
            </span>
          </div>
          <div className="espace" />
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Pseudonyme</th>
                <th style={{ width: 220 }}>Pièce</th>
                <th>Fichier</th>
                <th style={{ width: 150 }}>Type</th>
                <th style={{ width: 90 }}>Pages</th>
                <th style={{ width: 80 }}>Taille</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {pieces.flatMap((p) =>
                traites
                  .filter((f) => f.pieceCle === p.cle)
                  .map((f, i) => {
                    const nbPages = e.pages.filter((pg) => pg.fichierId === f.id).length;
                    return (
                      <tr key={f.id}>
                        <td>{i === 0 && <span className="pseudo">{p.pseudo}</span>}</td>
                        <td>
                          <input
                            type="text"
                            list="liste-pieces"
                            defaultValue={f.pieceCle}
                            style={{ width: "100%" }}
                            onBlur={(ev) => ev.target.value !== f.pieceCle && changerPiece(f.id, ev.target.value)}
                            onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                          />
                        </td>
                        <td className="mono petit" style={{ wordBreak: "break-all" }}>
                          {f.chemin}
                        </td>
                        <td>{LIBELLES_TYPES[f.type]}</td>
                        <td className="mono">{nbPages || (f.type === "step" || f.type === "tableur" ? "" : "…")}</td>
                        <td className="mono petit">{octetsLisibles(f.taille)}</td>
                        <td>
                          <button className="lien-pale danger" onClick={() => exclure(f.id)} title="Retirer ce fichier du lot">
                            Retirer
                          </button>
                        </td>
                      </tr>
                    );
                  }),
              )}
            </tbody>
          </table>
          <datalist id="liste-pieces">
            {pieces.map((p) => (
              <option key={p.cle} value={p.cle} />
            ))}
          </datalist>
        </>
      )}

      {ignores.length > 0 && (
        <div className="panneau-alerte" style={{ marginTop: 18 }}>
          <b>{ignores.length} fichier(s) non traité(s)</b>, ils ne feront pas partie du paquet :{" "}
          <span className="mono petit">{ignores.map((f) => f.nom).join(" · ")}</span>
        </div>
      )}
      {e.erreurs.length > 0 && (
        <div className="panneau-alerte" style={{ marginTop: 12 }}>
          {e.erreurs.map((er, i) => (
            <div key={i} className="petit">
              {er}
            </div>
          ))}
        </div>
      )}

      <div className="espace" />
      <div className="ligne pale petit">
        Vous avez enregistré un projet lors d'un précédent lot ?
        <button className="lien" onClick={() => inputProjet.current?.click()}>
          Reprendre ses réglages
        </button>
        <input
          ref={inputProjet}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (ev) => {
            const f = ev.target.files?.[0];
            ev.target.value = "";
            if (!f) return;
            try {
              chargerProjet(await f.text());
              setErreurProjet(null);
            } catch (err) {
              setErreurProjet(String(err));
            }
          }}
        />
        {erreurProjet && <span className="alerte">{erreurProjet}</span>}
      </div>
    </>
  );
}
