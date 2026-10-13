import { useEffect } from "react";
import logo from "./assets/logo-evolia-noir.png";
import { useEv, type Vue } from "./etat";
import { Externe, LIENS } from "./liens";
import { VERSION } from "./lib/livrables";
import { Accueil } from "./ui/Accueil";
import { Aide } from "./ui/Aide";
import { Chiffrement } from "./ui/Chiffrement";
import { Etape1 } from "./ui/Etape1";
import { Etape2 } from "./ui/Etape2";
import { Etape3 } from "./ui/Etape3";
import { Etape4 } from "./ui/Etape4";
import { Etape5 } from "./ui/Etape5";
import { Methodes } from "./ui/Methodes";

const ETAPES: [Vue, string][] = [
  [1, "Vos fichiers"],
  [2, "Ce qu'il faut masquer"],
  [3, "Zone commune aux plans"],
  [4, "Retouche plan par plan"],
  [5, "Envoi"],
];

export function App() {
  const { e, aller } = useEv();
  const fichiers = e.fichiers.filter((f) => f.type !== "ignore");
  const tousValides = fichiers.length > 0 && fichiers.every((f) => e.valides[f.id]);

  // Tout est en mémoire : prévenir avant de fermer l'onglet par erreur.
  useEffect(() => {
    const f = (ev: BeforeUnloadEvent) => {
      if (fichiers.length) ev.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [fichiers.length]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [e.vue]);

  const accessible = (n: number) => n === 1 || (fichiers.length > 0 && !e.analyse && (n < 5 || tousValides));

  return (
    <>
      <header className="entete">
        <div className="entete-int">
          <a href={LIENS.site} target="_blank" rel="noopener noreferrer" title="Evolia Stratégie (nouvel onglet)">
            <img src={logo} alt="Evolia Stratégie" />
          </a>
          <button className="produit" onClick={() => aller("accueil")} title="Accueil d'EvMasque">
            <b>EvMasque</b>
            <span>Anonymisation des données de chiffrage</span>
          </button>
          <nav className="nav">
            <button className={e.vue === "accueil" ? "actif" : ""} onClick={() => aller("accueil")}>
              Accueil
            </button>
            <button className={typeof e.vue === "number" ? "actif" : ""} onClick={() => aller(typeof e.vue === "number" ? e.vue : 1)}>
              Parcours
            </button>
            <button className={e.vue === "methodes" ? "actif" : ""} onClick={() => aller("methodes")}>
              Nos méthodes
            </button>
            <button className={e.vue === "chiffrement" ? "actif" : ""} onClick={() => aller("chiffrement")}>
              Chiffrement
            </button>
            <button className={e.vue === "aide" ? "actif" : ""} onClick={() => aller("aide")}>
              Aide
            </button>
          </nav>
        </div>
      </header>

      {typeof e.vue === "number" && (
        <div className="etapes">
          {ETAPES.map(([n, titre]) => (
            <button
              key={n}
              className={e.vue === n ? "actif" : typeof e.vue === "number" && (n as number) < e.vue ? "fait" : ""}
              disabled={!accessible(n as number)}
              onClick={() => aller(n)}
            >
              <span className="num">{typeof e.vue === "number" && (n as number) < e.vue ? "✓" : `0${n}`}</span>
              <span className="tit">{titre}</span>
            </button>
          ))}
        </div>
      )}

      <main>
        {e.vue === "accueil" && <Accueil />}
        {e.vue === 1 && <Etape1 />}
        {e.vue === 2 && <Etape2 />}
        {e.vue === 3 && <Etape3 />}
        {e.vue === 4 && <Etape4 />}
        {e.vue === 5 && <Etape5 />}
        {e.vue === "methodes" && <Methodes />}
        {e.vue === "chiffrement" && <Chiffrement />}
        {e.vue === "aide" && <Aide />}
      </main>

      <footer className="pied">
        <span>
          EvMasque {VERSION} · <Externe href={LIENS.code}>Code source</Externe> (
          <Externe href={LIENS.licence}>Apache 2.0</Externe>) · <Externe href={LIENS.licencesTiers}>Licences tierces</Externe>
        </span>
        <span>
          Un outil <Externe href={LIENS.site}>Evolia Stratégie</Externe> · <Externe href={LIENS.devis}>Devis automatisé</Externe> ·{" "}
          <Externe href={LIENS.audit}>Pré-audit IA</Externe> · <Externe href={LIENS.linkedin}>LinkedIn</Externe>
        </span>
        <span>Vos fichiers ne quittent pas ce poste</span>
      </footer>
    </>
  );
}
