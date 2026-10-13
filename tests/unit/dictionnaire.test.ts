import { describe, expect, it } from "vitest";
import { attribuerPseudos, creerTerme, numeroterPieces, suggerer } from "../../src/lib/dictionnaire";
import { cleDepuisNom, clePiece } from "../../src/lib/inventaire";

describe("pièces et pseudonymes", () => {
  it("regroupe par sous-dossier, sinon par début de nom", () => {
    expect(clePiece("Envoi/FA-20417-B/plan indice C.pdf")).toBe("FA-20417-B");
    expect(clePiece("Envoi/FA-20417-B_plan.pdf")).toBe("FA-20417-B");
    expect(cleDepuisNom("plan_GH-118-03.tif")).toBe("GH-118-03");
  });

  it("numérote les pièces et réutilise leur pseudonyme pour la référence identique", () => {
    const pieces = numeroterPieces(["GH-118-03", "FA-20417-B", "FA-20417-B"]);
    expect(pieces).toEqual([
      { cle: "FA-20417-B", pseudo: "P-001" },
      { cle: "GH-118-03", pseudo: "P-002" },
    ]);
    const termes = attribuerPseudos(
      [
        creerTerme("DUPONT SAS", "saisie"),
        creerTerme("Fischer Antriebe GmbH", "suggestion"),
        creerTerme("FA20417B", "piece"),
        creerTerme("XK-99", "saisie"),
        creerTerme("gh 118 03", "suggestion"),
        creerTerme("Jean Martin", "saisie"),
      ],
      pieces,
    );
    // Pas de catégorie : un pseudonyme neutre, sauf pour une référence de pièce.
    expect(termes.map((t) => t.pseudo)).toEqual(["MASQUE-001", "MASQUE-002", "P-001", "MASQUE-003", "P-002", "MASQUE-004"]);
  });
});

describe("suggestions", () => {
  it("propose raisons sociales, personnes, références et domaines d'e-mail", () => {
    const s = suggerer(
      [
        { texte: "Client : MÉCANIQUE DUPONT SAS", origine: "plan" },
        { texte: "Kunde: Fischer Antriebe GmbH  Gezeichnet: H. Weber", origine: "plan" },
        { texte: "Dessiné par : Jean Martin   N° de plan : FA-20417-B", origine: "plan" },
        { texte: "Contact j.martin@dupont-meca.fr", origine: "tableur" },
        { texte: "ECHELLE 1:1  MATIERE", origine: "plan" },
      ],
      ["GH-118-03"],
      [],
    );
    const valeurs = s.map((x) => x.valeur);
    expect(valeurs).toContain("MÉCANIQUE DUPONT SAS");
    expect(valeurs).toContain("Fischer Antriebe GmbH");
    expect(valeurs).toContain("Jean Martin");
    expect(valeurs).toContain("FA-20417-B");
    expect(valeurs).toContain("dupont-meca");
    expect(valeurs).toContain("GH-118-03");
    expect(valeurs).not.toContain("ECHELLE");
  });

  it("retire la référence collée devant une raison sociale", () => {
    const s = suggerer([{ texte: "FA-20417-B MÉCANIQUE DUPONT SAS", origine: "step" }], [], []);
    expect(s.map((x) => x.valeur)).toContain("MÉCANIQUE DUPONT SAS");
    expect(s.map((x) => x.valeur)).not.toContain("FA-20417-B MÉCANIQUE DUPONT SAS");
  });
});
