/** Étape 3 : la zone commune (le cartouche). Une zone dessinée une fois s'applique à tous les plans du même format. */
import { useState } from "react";
import { useEv } from "../etat";
import { cartoucheParDefaut } from "../lib/masquage";
import { Apercu } from "./Apercu";

export function Etape3() {
  const ev = useEv();
  const { e } = ev;
  const gabarits = e.gabarits.filter((g) => e.pages.some((p) => p.gabaritId === g.id));
  const [choisi, setChoisi] = useState(gabarits[0]?.id ?? "");
  const [rang, setRang] = useState(0);
  const g = gabarits.find((x) => x.id === choisi) ?? gabarits[0];
  const pages = g ? e.pages.filter((p) => p.gabaritId === g.id) : [];
  const page = pages[Math.min(rang, pages.length - 1)];
  const fichier = page && e.fichiers.find((f) => f.id === page.fichierId);

  return (
    <>
      <div className="intro">
        <div>
          <span className="libelle">Étape 3 sur 5</span>
          <h1>Zone commune aux plans</h1>
          <p>
            Placez ici <b>une seule zone</b>, en général le cartouche : elle sera noircie au même endroit sur{" "}
            <b>tous les plans du même format</b>. Ne cherchez pas à tout masquer à cette étape : le reste se fait plan par plan,
            à l'étape suivante.
          </p>
        </div>
        <button className="btn" onClick={() => ev.aller(4)}>
          Continuer
        </button>
      </div>

      <div className="grille-2 deux-temps">
        <div className="panneau">
          <span className="libelle">Étape 3 · ici · une fois pour tous les plans</span>
          <p className="petit" style={{ margin: "6px 0 0" }}>
            Ce qui est <b>au même endroit sur chaque plan</b> : le cartouche, le logo, le tableau des indices. Gardez la zone
            ajustée : trop grande, elle cacherait sur tous les plans des cotes utiles au chiffrage.
          </p>
        </div>
        <div className="panneau panneau-neutre">
          <span className="libelle">Étape 4 · ensuite · plan par plan</span>
          <p className="petit" style={{ margin: "6px 0 0" }}>
            Ce qui est <b>propre à chaque plan</b> : un nom hors du cartouche, une référence dans une note, une adresse.
            Presque chaque plan demande une petite retouche : vous la ferez en vérifiant les plans un par un.
          </p>
        </div>
      </div>
      <div className="espace" />

      {gabarits.length === 0 ? (
        <div className="panneau">Aucun plan dans le lot : rien à faire à cette étape.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 24, alignItems: "start" }}>
          <div className="liste-fichiers">
            {gabarits.map((x) => {
              const n = e.pages.filter((p) => p.gabaritId === x.id).length;
              return (
                <button
                  key={x.id}
                  className={x.id === g?.id ? "actif" : ""}
                  onClick={() => {
                    setChoisi(x.id);
                    setRang(0);
                  }}
                >
                  <span className="nom">{x.libelle}</span>
                  <span className="mono petit pale">{x.zones.length} zone(s)</span>
                  <span className="pale petit">
                    {n} page{n > 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {g && page && fichier && (
            <div>
              <div className="ligne" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div className="ligne">
                  <button className="btn-sec" onClick={() => setRang((r) => Math.max(0, r - 1))} disabled={rang === 0}>
                    ‹
                  </button>
                  <span className="mono petit">
                    Plan {Math.min(rang, pages.length - 1) + 1} / {pages.length} · {fichier.nom} · page {page.index + 1}
                  </span>
                  <button className="btn-sec" onClick={() => setRang((r) => Math.min(pages.length - 1, r + 1))} disabled={rang >= pages.length - 1}>
                    ›
                  </button>
                </div>
                <div className="ligne">
                  <button className="btn-sec" onClick={() => ev.majZones(g.id, [...g.zones, cartoucheParDefaut(g.largeurMm, g.hauteurMm)])}>
                    Proposer le cartouche standard
                  </button>
                  <button className="lien-pale danger" onClick={() => ev.majZones(g.id, [])}>
                    Retirer les zones de ce format
                  </button>
                </div>
              </div>
              <p className="pale petit">
                Cliquez-glissez pour ajouter une zone · × pour en retirer une. Faites défiler quelques plans pour vérifier que la
                zone tombe juste sur chacun.
              </p>
              <Apercu
                fichier={fichier}
                page={page}
                hauteurMax="72vh"
                rects={g.zones.map((z, i) => ({
                  ...z,
                  cle: `z${i}`,
                  classe: "zone",
                  titre: "Zone masquée sur tous les plans de ce format",
                  onRetirer: () => ev.majZones(g.id, g.zones.filter((_, k) => k !== i)),
                }))}
                onTrace={(r) => ev.majZones(g.id, [...g.zones, r])}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
