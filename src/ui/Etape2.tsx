/** Étape 2 : ce qu'il faut masquer (dictionnaire, suggestions, coordonnées, colonnes de prix). */
import { useState } from "react";
import { useEv } from "../etat";
import { LIBELLES_ORIGINES } from "../lib/dictionnaire";
import { LIBELLES_MOTIFS, TOUS_LES_MOTIFS } from "../lib/texte";

export function Etape2() {
  const ev = useEv();
  const { e } = ev;
  const [valeur, setValeur] = useState("");
  const tableurs = e.fichiers.filter((f) => f.type === "tableur" && e.tableurs[f.id]);
  const feuillesMasquees = tableurs.flatMap((f) => e.tableurs[f.id].feuilles.filter((fe) => fe.masquee).map((fe) => `${f.nom} › ${fe.nom}`));

  const ajouter = () => {
    ev.ajouterTerme(valeur);
    setValeur("");
  };

  return (
    <>
      <div className="intro">
        <div>
          <span className="libelle">Étape 2 sur 5</span>
          <h1>Ce qu'il faut masquer</h1>
          <p>
            Indiquez vos clients, leurs références et les noms à faire disparaître. Chaque valeur est remplacée par un
            pseudonyme dans les fichiers texte, et noircie sur les plans. Les références de vos pièces sont déjà dans la liste.
          </p>
        </div>
        <button className="btn" onClick={() => ev.aller(3)}>
          Continuer
        </button>
      </div>

      {e.ocr && (
        <div className="panneau" style={{ marginBottom: 18 }}>
          <span className="libelle">
            {e.ocr.libelle} · {e.ocr.fait} / {e.ocr.total}
          </span>
          <div className="barre">
            <i style={{ width: `${(100 * e.ocr.fait) / Math.max(1, e.ocr.total)}%` }} />
          </div>
          <p className="petit pale" style={{ margin: "8px 0 0" }}>
            La lecture continue pendant que vous travaillez. Les suggestions se complètent au fur et à mesure.
          </p>
        </div>
      )}

      <div className="grille-2">
        <div>
          <h2>Votre dictionnaire</h2>
          <div className="espace" />
          <div className="ligne">
            <input
              type="text"
              placeholder="Nom de client, référence, nom de personne…"
              value={valeur}
              onChange={(x) => setValeur(x.target.value)}
              onKeyDown={(x) => x.key === "Enter" && ajouter()}
              style={{ flex: 1 }}
              aria-label="Valeur à masquer"
            />
            <button className="btn-sec" onClick={ajouter} disabled={!valeur.trim()}>
              Ajouter
            </button>
          </div>
          <div className="espace" />
          <table className="t">
            <thead>
              <tr>
                <th style={{ width: 30 }} />
                <th>Valeur masquée</th>
                <th style={{ width: 110 }}>Devient</th>
                <th style={{ width: 30 }} />
              </tr>
            </thead>
            <tbody>
              {e.termes.map((t) => (
                <tr key={t.id} style={{ opacity: t.actif ? 1 : 0.5 }}>
                  <td>
                    <input type="checkbox" checked={t.actif} onChange={() => ev.modifierTerme(t.id, { actif: !t.actif })} title="Masquer cette valeur" />
                  </td>
                  <td>
                    <span style={{ fontWeight: 500, color: "var(--encre)" }}>{t.valeur}</span>
                    <div className="pale petit">{LIBELLES_ORIGINES[t.origine]}</div>
                  </td>
                  <td>
                    <span className="pseudo">{t.pseudo}</span>
                  </td>
                  <td>
                    {t.origine !== "piece" && (
                      <button className="lien-pale danger" onClick={() => ev.supprimerTerme(t.id)} title="Retirer du dictionnaire">
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2>Suggestions trouvées dans vos fichiers</h2>
          <p className="pale petit" style={{ marginTop: 6 }}>
            Raisons sociales, noms après « Client », « Kunde » ou « Dessiné par », numéros de plan, domaines d'e-mail.
            À vous de décider : rien n'est ajouté sans votre accord. Sur les plans scannés, la lecture automatique peut
            déformer un nom : ignorez ce qui est mal lu, vous le masquerez directement sur le plan à l'étape 4.
          </p>
          {e.suggestions.length === 0 ? (
            <div className="panneau petit">Aucune suggestion pour l'instant.</div>
          ) : (
            <table className="t">
              <thead>
                <tr>
                  <th>Valeur</th>
                  <th style={{ width: 150 }}>Pourquoi</th>
                  <th style={{ width: 150 }} />
                </tr>
              </thead>
              <tbody>
                {e.suggestions.slice(0, 60).map((s) => (
                  <tr key={s.valeur}>
                    <td>
                      <span style={{ fontWeight: 500, color: "var(--encre)" }}>{s.valeur}</span>
                      {s.occurrences > 1 && <div className="pale petit">vu {s.occurrences} fois</div>}
                    </td>
                    <td className="petit pale">{s.raison}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn-sec" style={{ padding: "5px 10px" }} onClick={() => ev.accepterSuggestion(s)}>
                        Masquer
                      </button>{" "}
                      <button className="lien-pale" onClick={() => ev.rejeterSuggestion(s)}>
                        Ignorer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="espace" />
      <div className="espace" />
      <div className="grille-2">
        <div className="cadre">
          <h3>Coordonnées masquées automatiquement</h3>
          <p className="pale petit" style={{ marginTop: 6 }}>
            Repérées sur les plans et dans les fichiers, même si elles ne sont pas dans votre dictionnaire.
          </p>
          {TOUS_LES_MOTIFS.map((m) => (
            <label key={m} className="ligne" style={{ padding: "4px 0" }}>
              <input type="checkbox" checked={e.motifs.includes(m)} onChange={() => ev.basculerMotif(m)} />
              {LIBELLES_MOTIFS[m]}
            </label>
          ))}
          <div className="espace" />
          <label className="ligne">
            <input
              type="checkbox"
              checked={e.options.ocrTousLesPlans}
              onChange={() => {
                ev.options({ ocrTousLesPlans: !e.options.ocrTousLesPlans });
                setTimeout(() => ev.lancerOcr(), 0);
              }}
            />
            <span>
              Lecture renforcée : passer aussi l'OCR sur les plans PDF vectoriels
              <span className="pale petit"> (plus lent, utile si des textes du cartouche sont dessinés)</span>
            </span>
          </label>
        </div>

        <div className="cadre">
          <h3>Tableurs : prix, taux et marges</h3>
          <p className="pale petit" style={{ marginTop: 6 }}>
            Evolia ne vous demande pas vos prix. Les colonnes repérées sont retirées par défaut ; cochez celles à conserver.
          </p>
          {tableurs.length === 0 && <div className="pale petit">Aucun tableur dans le lot.</div>}
          {tableurs.map((f) =>
            e.tableurs[f.id].feuilles
              .filter((fe) => fe.entetes.some((h) => h))
              .map((fe) => (
                <div key={f.id + fe.nom} style={{ borderTop: "1px solid var(--filet)", padding: "8px 0" }}>
                  <div className="mono petit">
                    {f.nom} › {fe.nom}
                    {fe.masquee && <span className="alerte"> (feuille masquée)</span>}
                  </div>
                  <div className="ligne" style={{ marginTop: 4, gap: "4px 14px" }}>
                    {fe.entetes.map((h, j) =>
                      h ? (
                        <label key={j} className="ligne petit" style={{ gap: 5 }}>
                          <input
                            type="checkbox"
                            checked={!(e.colonnes[f.id]?.[fe.nom] ?? []).includes(j)}
                            onChange={() => ev.basculerColonne(f.id, fe.nom, j)}
                          />
                          <span style={{ textDecoration: (e.colonnes[f.id]?.[fe.nom] ?? []).includes(j) ? "line-through" : undefined }}>{h}</span>
                        </label>
                      ) : null,
                    )}
                  </div>
                </div>
              )),
          )}
          {feuillesMasquees.length > 0 && (
            <label className="ligne" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={e.options.inclureFeuillesMasquees} onChange={() => ev.options({ inclureFeuillesMasquees: !e.options.inclureFeuillesMasquees })} />
              <span>
                Inclure les feuilles masquées <span className="pale petit">({feuillesMasquees.join(", ")})</span>
              </span>
            </label>
          )}
        </div>
      </div>
    </>
  );
}
