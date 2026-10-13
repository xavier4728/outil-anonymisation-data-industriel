/** Page « Nos méthodes » : ce que fait EvMasque, comment le vérifier, et ses limites. */
import { useEv } from "../etat";
import { VERSION } from "../lib/livrables";
import { Externe, LIENS } from "../liens";

/** Les bibliothèques intégrées, leur rôle et leur licence (liste complète : licences-tiers.txt, produit à la construction). */
const CREDITS: [string, string, string][] = [
  ["pdf.js (Mozilla)", "Lecture et rendu des PDF, décodeurs JBIG2, JPEG 2000", "Apache-2.0"],
  ["Tesseract.js", "Reconnaissance de texte (OCR) français, allemand, anglais", "Apache-2.0"],
  ["pdf-lib", "Fabrication des PDF anonymisés", "MIT"],
  ["SheetJS", "Lecture et écriture des tableurs", "Apache-2.0"],
  ["zip.js", "Archive chiffrée AES-256", "BSD-3-Clause"],
  ["UTIF.js", "Lecture des TIF", "MIT"],
  ["React", "Interface", "MIT"],
  ["Inter, JetBrains Mono", "Polices", "OFL-1.1"],
];

export function Methodes() {
  const { aller } = useEv();
  return (
    <div className="methodes">
      <span className="libelle">Nos méthodes</span>
      <h1 style={{ marginTop: 4 }}>Comment EvMasque protège vos données</h1>
      <p style={{ fontSize: 15, fontWeight: 300, margin: "10px 0 22px" }}>
        Vous allez confier à Evolia Stratégie des plans et des études de chiffrage qui appartiennent en partie à vos
        clients. Voici exactement ce que fait cet outil, comment le vérifier par vous-même, et ce qu'il ne fait pas.
      </p>

      <section>
        <span className="n">01</span>
        <div>
          <h2>Rien ne quitte votre poste</h2>
          <p>
            EvMasque est une page autonome : tout son code, ses moteurs de lecture et ses données (langues de l'OCR,
            polices) sont contenus dans la page elle-même. Vos fichiers sont lus et traités <b>dans cet onglet</b>, par votre
            navigateur. Le site qui vous livre la page s'arrête là : aucun serveur ne reçoit vos fichiers. Il n'y a ni compte,
            ni mesure d'audience, ni stockage dans le navigateur.
          </p>
          <p>
            La page déclare un <b>verrou réseau</b> (<span className="mono">Content-Security-Policy</span>) qui interdit au
            navigateur toute connexion sortante. Ce verrou est appliqué par le navigateur lui-même : même une erreur de notre
            part ne pourrait pas envoyer un fichier.
          </p>
          <ul>
            <li>
              <b>Vérifiez-le :</b> coupez votre connexion (Wi-Fi, câble) après avoir ouvert la page. L'outil continue de
              fonctionner normalement.
            </li>
            <li>
              <b>Pour votre service informatique :</b> l'onglet « Réseau » des outils de développement (F12) ne montre aucune
              requête pendant le traitement.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <span className="n">02</span>
        <div>
          <h2>Vos fichiers d'origine ne sont jamais modifiés</h2>
          <p>
            L'outil lit vos fichiers sans y écrire. Tout ce qu'il produit est un fichier neuf, enregistré à l'endroit que
            vous choisissez sur votre poste. Quand vous fermez l'onglet, tout ce qu'il avait en mémoire disparaît.
          </p>
        </div>
      </section>

      <section>
        <span className="n">03</span>
        <div>
          <h2>On reconstruit, on ne cache pas</h2>
          <p>
            Poser un rectangle noir sur un PDF ne suffit pas : le texte reste souvent dessous, et un fichier contient bien
            d'autres choses (calques, métadonnées, anciennes versions, pièces jointes). EvMasque ne retouche donc pas vos
            fichiers : il en <b>fabrique de nouveaux</b>.
          </p>
          <ul>
            <li>
              <b>Plans</b> (PDF, TIF, JPG, PNG) : chaque page est redessinée en image à 300 points par pouce, les zones sont
              noircies <b>dans les pixels</b>, puis l'image est placée dans un PDF vide. Rien du fichier d'origine n'est recopié.
            </li>
            <li>
              <b>Tableurs</b> : un classeur neuf est créé avec les seules valeurs des cellules. Les noms sont remplacés par
              des pseudonymes, les colonnes de prix retirées par défaut.
            </li>
            <li>
              <b>Fichiers STEP</b> : seuls les textes d'identification sont réécrits. La géométrie est recopiée à
              l'identique, et c'est vérifié.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <span className="n">04</span>
        <div>
          <h2>Ce qui est retiré, format par format</h2>
          <table className="t" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 150 }}>Format</th>
                <th>Retiré ou remplacé</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Plans PDF</td>
                <td>
                  Zones de cartouche et de logo que vous dessinez ; noms, références et coordonnées trouvés dans le texte du
                  PDF ou par OCR ; et, du fait de la reconstruction : texte, calques, annotations, pièces jointes, métadonnées,
                  versions antérieures, scripts.
                </td>
              </tr>
              <tr>
                <td>TIF, JPG, PNG</td>
                <td>Les mêmes zones et textes (lus par OCR) ; balises EXIF, IPTC et XMP.</td>
              </tr>
              <tr>
                <td>STEP</td>
                <td>
                  En-tête (nom de fichier, auteur, organisation, logiciel d'origine, date), nom et description du produit,
                  personnes, organisations, adresses, approbations, chemins d'accès, commentaires, et tout texte contenant un
                  terme de votre dictionnaire.
                </td>
              </tr>
              <tr>
                <td>Excel, CSV, ODS</td>
                <td>
                  Termes du dictionnaire et coordonnées dans les cellules et les noms de feuilles ; propriétés du document,
                  commentaires, images, liens externes, formules ; colonnes de prix, taux et marges ; feuilles masquées (sauf
                  si vous les incluez).
                </td>
              </tr>
              <tr>
                <td>Noms de fichiers</td>
                <td>Remplacés par des pseudonymes : P-001_plan.pdf, P-001_3d.step…</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <span className="n">05</span>
        <div>
          <h2>Un double contrôle automatique</h2>
          <p>Une fois les fichiers produits, EvMasque les relit comme le ferait un tiers :</p>
          <ul>
            <li>chaque plan produit ne doit contenir <b>aucun caractère de texte</b>, aucune métadonnée, aucune pièce jointe ;</li>
            <li>chaque nom ou coordonnée trouvé sur un plan doit être entièrement couvert par un masque ;</li>
            <li>chaque fichier STEP doit garder une géométrie identique à l'original, sans aucun terme du dictionnaire ;</li>
            <li>chaque tableur est relu cellule par cellule ;</li>
            <li>aucun nom de fichier produit ne doit contenir un terme.</li>
          </ul>
          <p>
            Un fichier qui échoue à un contrôle est <b>bloqué</b> : le paquet ne peut pas être enregistré tant qu'il n'est
            pas corrigé ou retiré.
          </p>
        </div>
      </section>

      <section>
        <span className="n">06</span>
        <div>
          <h2>Vous validez chaque fichier</h2>
          <p>
            Rien n'est enregistré sans votre validation, fichier par fichier, après un aperçu avant / après. Si vous laissez
            volontairement un élément visible, ce choix est inscrit dans le rapport.
          </p>
        </div>
      </section>

      <section>
        <span className="n">07</span>
        <div>
          <h2>Ce qui reste chez vous</h2>
          <ul>
            <li>
              La <b>table de correspondance</b>, qui relie P-001 ou MASQUE-001 à vos vraies références. Elle est rangée dans un
              dossier séparé, <span className="mono">A_GARDER</span>, et n'est jamais incluse dans le paquet à envoyer.
            </li>
            <li>
              Le <b>mot de passe</b> de l'archive chiffrée (AES-256). Il n'est enregistré nulle part : il s'affiche une fois,
              et vous nous le communiquez par téléphone. Détail et ouverture de l'archive :{" "}
              <button className="lien" onClick={() => aller("chiffrement")}>
                page « Chiffrement »
              </button>
              .
            </li>
            <li>
              Le <b>rapport d'anonymisation</b>, qui accompagne aussi le paquet : il décrit ce qui a été fait, sans aucune
              valeur d'origine, avec l'empreinte SHA-256 de chaque fichier.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <span className="n">08</span>
        <div>
          <h2>Les limites, dites franchement</h2>
          <ul>
            <li>
              <b>L'anonymisation retire l'identité, pas la forme.</b> Une pièce reste reconnaissable par quelqu'un qui la
              connaît. Pour un essai, choisissez de préférence une famille de pièces peu sensible.
            </li>
            <li>
              <b>L'OCR peut manquer un texte</b> manuscrit, très petit ou très dégradé. C'est pourquoi les zones de cartouche
              sont masquées en entier et pourquoi vous validez chaque plan à l'œil.
            </li>
            <li>
              <b>Les suggestions sont des propositions.</b> Seul ce que vous mettez dans le dictionnaire est remplacé.
            </li>
            <li>
              <b>Un plan anonymisé est une image</b> : son texte n'est plus sélectionnable. C'est la contrepartie de la
              garantie qu'aucune information cachée n'y subsiste.
            </li>
          </ul>
        </div>
      </section>

      <section>
        <span className="n">09</span>
        <div>
          <h2>Des briques connues, un code ouvert</h2>
          <p>
            Le code source d'EvMasque est <b>public</b>, sous licence libre Apache 2.0 :{" "}
            <Externe href={LIENS.code}>github.com/xavier4728/outil-anonymisation-data-industriel</Externe>. Votre service
            informatique peut l'auditer et reconstruire la page lui-même. Il contient aussi
            la recette automatique qui rejoue tous les contrôles sur un jeu de plans fictifs.
          </p>
          <p>EvMasque assemble des bibliothèques libres et éprouvées, toutes incluses dans la page :</p>
          <table className="t" style={{ marginTop: 4 }}>
            <tbody>
              {CREDITS.map(([nom, role, licence]) => (
                <tr key={nom}>
                  <td style={{ width: 190 }}>
                    <b style={{ fontWeight: 500, color: "var(--encre)" }}>{nom}</b>
                  </td>
                  <td className="petit">{role}</td>
                  <td className="petit mono pale" style={{ width: 150 }}>
                    {licence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="petit" style={{ marginTop: 10 }}>
            Textes complets de ces licences : <Externe href={LIENS.licencesTiers}>licences-tiers.txt</Externe>.
          </p>
          <p className="pale petit">
            EvMasque {VERSION} · un outil gratuit d'<Externe href={LIENS.site}>Evolia Stratégie</Externe>, partenaire IA des PME
            et ETI industrielles.
          </p>
        </div>
      </section>
    </div>
  );
}
