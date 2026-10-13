/** Page « Chiffrement » : l'archive chiffrée, son mot de passe, et comment l'ouvrir. */

export const SITE_7ZIP = "https://www.7-zip.org/";

export function Lien7Zip({ children = "www.7-zip.org" }: { children?: string }) {
  return (
    <a href={SITE_7ZIP} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function Chiffrement() {
  return (
    <div className="methodes">
      <span className="libelle">Chiffrement</span>
      <h1 style={{ marginTop: 4 }}>Le paquet chiffré et son mot de passe</h1>
      <p style={{ fontSize: 15, fontWeight: 300, margin: "10px 0 22px" }}>
        Le paquet que vous envoyez à Evolia Stratégie est une archive ZIP chiffrée. Sans son mot de passe, personne ne
        peut en lire le contenu, même si le message qui la transporte est intercepté ou transféré par erreur.
      </p>

      <section>
        <span className="n">01</span>
        <div>
          <h2>Ce qui est chiffré</h2>
          <ul>
            <li>
              L'archive <span className="mono">A_ENVOYER_chiffre.zip</span> : les fichiers anonymisés, le fichier de collecte
              et le rapport d'anonymisation.
            </li>
            <li>
              Le chiffrement est l'<b>AES-256</b>, au format WinZip AES : le plus robuste que propose le format ZIP, lu par
              tous les grands logiciels d'archives.
            </li>
            <li>
              Le dossier <span className="mono">A_GARDER</span> n'est pas chiffré : il ne quitte pas votre poste. Rangez-le
              comme vos autres documents confidentiels.
            </li>
            <li className="pale">
              Comme dans toute archive ZIP, les <b>noms</b> des fichiers restent lisibles sans le mot de passe. Ce sont des
              pseudonymes (<span className="mono">P-001/P-001_plan.pdf</span>) : ils ne révèlent rien.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <span className="n">02</span>
        <div>
          <h2>Le mot de passe</h2>
          <ul>
            <li>
              Il est tiré au hasard <b>dans votre navigateur</b>, au moment de l'enregistrement : 20 caractères en 5 groupes,
              par exemple <span className="mono">K7QD-M3XA-9PZT-HW4E-R2NC</span>. Les caractères qu'on confond à la lecture
              (0 et O, 1 et I) sont exclus.
            </li>
            <li>
              Il s'affiche <b>une seule fois</b>, à l'étape 5. Il n'est enregistré nulle part : ni dans la page, ni dans vos
              fichiers, ni chez Evolia. Notez-le avant de fermer l'onglet.
            </li>
            <li>
              Perdu ? Relancez l'enregistrement à l'étape 5 tant que l'onglet est ouvert : une nouvelle archive est créée,
              avec un nouveau mot de passe. Supprimez alors l'ancienne.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <span className="n">03</span>
        <div>
          <h2>Nous l'envoyer : deux chemins séparés</h2>
          <ol className="etapes-num">
            <li>
              <b>L'archive</b> : par e-mail si sa taille le permet, sinon par le service de transfert de fichiers habituel de
              votre entreprise.
            </li>
            <li>
              <b>Le mot de passe</b> : par <b>téléphone ou SMS</b>, jamais dans le même message que l'archive. Ainsi, une
              personne qui intercepterait l'un n'aurait pas l'autre.
            </li>
          </ol>
          <p className="petit" style={{ marginTop: 10 }}>
            Xavier Demange · <a href="mailto:x.demange@evoliastrategie.com">x.demange@evoliastrategie.com</a>
            <br />
            Jean-François de Greling · <a href="mailto:j.degreling@evoliastrategie.com">j.degreling@evoliastrategie.com</a>
          </p>
        </div>
      </section>

      <section>
        <span className="n">04</span>
        <div>
          <h2>Ouvrir l'archive avec 7-Zip</h2>
          <p>
            L'explorateur de Windows ne sait pas toujours ouvrir une archive chiffrée en AES-256. Le plus simple est{" "}
            <b>7-Zip</b>, gratuit et libre, très répandu en entreprise. Nous vous conseillons de l'utiliser pour vérifier le
            paquet avant de l'envoyer.
          </p>
          <ol className="etapes-num">
            <li>
              Téléchargez 7-Zip sur son site officiel, <Lien7Zip />, version 64 bits pour Windows, puis installez-le. Si votre
              poste est géré par votre service informatique, demandez-lui de l'installer.
            </li>
            <li>
              Clic droit sur <span className="mono">A_ENVOYER_chiffre.zip</span> › <b>Afficher plus d'options</b> › <b>7-Zip</b>{" "}
              › <b>Extraire vers « A_ENVOYER_chiffre\ »</b>.
            </li>
            <li>Saisissez le mot de passe, tirets compris.</li>
          </ol>
          <div className="panneau petit" style={{ marginTop: 12 }}>
            <b>Vérifiez par vous-même :</b> avec un mauvais mot de passe, 7-Zip doit refuser l'ouverture. Avec le bon, vous
            voyez exactement ce que nous recevrons : un dossier par pièce, le fichier de collecte et le rapport, mais jamais la
            table de correspondance.
          </div>
          <p className="pale petit" style={{ marginTop: 10 }}>
            Sur Mac, l'utilitaire d'archive intégré ne lit pas ce chiffrement : utilisez Keka ou The Unarchiver, gratuits.
          </p>
        </div>
      </section>
    </div>
  );
}
