/** Page d'aide : le parcours en bref et les questions fréquentes. */
import { useEv } from "../etat";

export function Aide() {
  const { aller } = useEv();
  const questions: [string, string][] = [
    [
      "Combien de temps faut-il ?",
      "Comptez une dizaine de minutes de votre temps pour une cinquantaine de pièces. La lecture des plans scannés et la production des fichiers tournent toutes seules : quelques secondes par page.",
    ],
    [
      "Je ne peux pas déposer un dossier.",
      "Utilisez le bouton « Choisir un ou plusieurs fichiers » et sélectionnez-les tous (Ctrl + A). Le regroupement par pièce se fera alors à partir du début des noms de fichiers.",
    ],
    [
      "Un fichier n'est pas regroupé avec la bonne pièce.",
      "À l'étape 1, modifiez le nom de pièce de ce fichier : saisissez la même valeur que pour les autres fichiers de la pièce.",
    ],
    [
      "Quelle différence entre l'étape 3 et l'étape 4 ?",
      "L'étape 3 place une seule zone, en général le cartouche, au même endroit sur tous les plans d'un même format : on la règle une fois. L'étape 4 passe les plans un par un, pour masquer ce qui est propre à chacun (un nom hors du cartouche, une référence dans une note). Presque chaque plan demande une petite retouche à l'étape 4.",
    ],
    [
      "La zone du cartouche ne tombe pas juste sur certains plans.",
      "À l'étape 3, faites défiler les plans du format concerné et ajustez ou ajoutez une zone. Pour un seul plan, ajoutez plutôt un masque à l'étape 4.",
    ],
    [
      "Un fichier est « bloqué ».",
      "Le double contrôle a trouvé un problème. Le message indique lequel : corrigez à l'étape 4, ou retirez le fichier du lot à l'étape 1, puis relancez la production.",
    ],
    [
      "Comment ouvrir l'archive chiffrée ?",
      "Avec 7-Zip, gratuit (www.7-zip.org) : clic droit sur l'archive › 7-Zip › Extraire, puis saisissez le mot de passe affiché à l'étape 5. L'explorateur de Windows ne sait pas toujours ouvrir ce chiffrement. Tout le détail est sur la page « Chiffrement ».",
    ],
    [
      "J'ai perdu le mot de passe de l'archive.",
      "Il n'est enregistré nulle part. Relancez l'enregistrement à l'étape 5 : un nouveau mot de passe sera créé.",
    ],
    [
      "Mon navigateur télécharge des fichiers au lieu de me demander un dossier.",
      "Certains navigateurs (Firefox, Safari) ne savent pas écrire dans un dossier. EvMasque enregistre alors deux archives dans vos téléchargements : A_ENVOYER et A_GARDER.",
    ],
    [
      "Je veux réutiliser mes réglages pour un prochain lot.",
      "Le fichier projet-evmasque.json, rangé dans A_GARDER, contient votre dictionnaire et vos zones. À l'étape 1, choisissez « Reprendre ses réglages ».",
    ],
  ];
  return (
    <div className="methodes">
      <span className="libelle">Aide</span>
      <h1 style={{ marginTop: 4 }}>Utiliser EvMasque</h1>
      <p style={{ fontSize: 15, fontWeight: 300, margin: "10px 0 22px" }}>
        Cinq étapes : vos fichiers, ce qu'il faut masquer, la zone commune aux plans, la retouche plan par plan, l'envoi.
        Vous pouvez revenir à une étape précédente à tout moment ; rien n'est perdu tant que l'onglet reste ouvert. Pour
        l'archive chiffrée et son mot de passe, voir la page{" "}
        <button className="lien" onClick={() => aller("chiffrement")}>
          Chiffrement
        </button>
        .
      </p>
      {questions.map(([q, r], i) => (
        <section key={i}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h2>{q}</h2>
            <p>{r}</p>
          </div>
        </section>
      ))}
      <section>
        <span className="n">✉</span>
        <div>
          <h2>Une question en préparant l'envoi ?</h2>
          <p>
            Xavier Demange, direction technique · <a href="mailto:x.demange@evoliastrategie.com">x.demange@evoliastrategie.com</a>
            <br />
            Jean-François de Greling, direction commerciale ·{" "}
            <a href="mailto:j.degreling@evoliastrategie.com">j.degreling@evoliastrategie.com</a>
            <br />
            <a href="https://www.evoliastrategie.com" target="_blank" rel="noopener noreferrer">
              www.evoliastrategie.com
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
