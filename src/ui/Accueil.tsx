/** Page d'accueil : ce que fait EvMasque, comment, et pourquoi vos données restent chez vous. */
import { useEv } from "../etat";
import { Externe, LIENS } from "../liens";

const ETAPES: [string, string, string][] = [
  ["01", "Vos fichiers", "Déposez un seul plan, quelques fichiers ou un dossier complet."],
  ["02", "Ce qu'il faut masquer", "Indiquez vos clients et vos références. EvMasque propose ce qu'il trouve dans vos fichiers."],
  ["03", "Zone commune aux plans", "Placez une fois le cartouche : il est noirci sur tous les plans du même format."],
  ["04", "Retouche plan par plan", "Comparez avant et après, masquez ce qui reste, validez chaque fichier."],
  ["05", "Envoi", "Une archive chiffrée à envoyer, une table de correspondance qui reste chez vous."],
];

const GARANTIES: [string, string][] = [
  [
    "Rien ne quitte votre poste",
    "Vos fichiers sont traités dans cet onglet, par votre navigateur. Un verrou réseau lui interdit toute connexion sortante : coupez votre Wi-Fi, l'outil fonctionne toujours.",
  ],
  [
    "Reconstruit, pas caché",
    "Chaque plan est redessiné en image, masques peints dans les pixels. Aucun texte, calque ni métadonnée d'origine ne subsiste sous un rectangle noir.",
  ],
  [
    "Double contrôle, et votre validation",
    "Chaque fichier produit est relu par l'outil ; au moindre doute, il est bloqué. Rien n'est enregistré sans que vous ayez validé chaque fichier.",
  ],
  [
    "Chiffré pour l'envoi",
    "Archive AES-256, mot de passe affiché une seule fois et enregistré nulle part. La table de correspondance ne part jamais.",
  ],
];

export function Accueil() {
  const { e, aller } = useEv();
  const enCours = e.fichiers.length > 0;
  const commencer = (
    <button className="btn" onClick={() => aller(1)}>
      {enCours ? "Reprendre le parcours" : "Commencer"}
    </button>
  );

  return (
    <div className="accueil">
      <section className="accroche">
        <span className="libelle">Outil gratuit · 100 % dans votre navigateur</span>
        <h1>Anonymisez vos plans et vos données de chiffrage avant de les confier</h1>
        <p>
          EvMasque retire de vos plans, fichiers STEP et études Excel tout ce qui identifie vos clients (raisons sociales,
          références, noms, adresses, coordonnées) et garde ce qui sert au chiffrage : cotes, tolérances, matières, temps.{" "}
          <b>Vos fichiers ne quittent jamais votre poste.</b>
        </p>
        <div className="ligne" style={{ marginTop: 22 }}>
          {commencer}
          <button className="btn-sec" onClick={() => aller("methodes")}>
            Comment nous protégeons vos données
          </button>
        </div>
        <p className="pale petit" style={{ marginTop: 14 }}>
          Aucune installation, aucun compte. Comptez une dizaine de minutes pour une cinquantaine de pièces ; un seul plan
          prend une minute.
        </p>
      </section>

      <section>
        <h2>À quoi ça sert</h2>
        <p>
          Faire tester un outil de chiffrage, consulter un sous-traitant, demander un avis sur une pièce : il faut souvent
          montrer de vrais plans, qui appartiennent en partie à vos donneurs d'ordres. EvMasque vous permet de les partager{" "}
          <b>sans révéler à qui ils appartiennent</b>, et de relire ensuite les résultats sur vos vraies références grâce à la
          table de correspondance que vous gardez.
        </p>
      </section>

      <section>
        <h2>Comment ça marche</h2>
        <div className="cartes-etapes">
          {ETAPES.map(([n, titre, texte]) => (
            <div key={n} className="carte">
              <span className="mono pale petit">{n}</span>
              <h3>{titre}</h3>
              <p className="petit">{texte}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Vos données restent chez vous</h2>
        <div className="grille-2 garanties">
          {GARANTIES.map(([titre, texte]) => (
            <div key={titre} className="panneau">
              <h3>
                <span className="ok">✓</span> {titre}
              </h3>
              <p className="petit" style={{ margin: "6px 0 0" }}>
                {texte}
              </p>
            </div>
          ))}
        </div>
        <p className="petit" style={{ marginTop: 14 }}>
          Pour aller plus loin : <button className="lien" onClick={() => aller("methodes")}>nos méthodes en détail</button> ·{" "}
          <button className="lien" onClick={() => aller("chiffrement")}>le chiffrement et l'ouverture de l'archive</button> ·{" "}
          <Externe href={LIENS.code}>le code source, public</Externe>
        </p>
      </section>

      <section>
        <h2>Formats pris en charge</h2>
        <p>
          Plans PDF vectoriels et scannés, TIF, JPG, PNG · fichiers 3D STEP · Excel et CSV (colonnes de prix retirées par
          défaut). Lecture des textes en français, allemand et anglais. Chrome ou Edge conseillés.
        </p>
      </section>

      <section className="fin">
        {commencer}
        <span className="petit pale">
          Une question ? <button className="lien" onClick={() => aller("aide")}>Aide et contact</button>
        </span>
      </section>
    </div>
  );
}
