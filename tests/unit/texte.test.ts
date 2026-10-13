import { describe, expect, it } from "vitest";
import {
  compacter,
  detecterSurSegments,
  remplacerDansTexte,
  trouverMotifs,
  trouverTerme,
  tauxCouverture,
} from "../../src/lib/texte";

describe("trouverTerme", () => {
  it("retrouve un nom malgré la casse, les accents, les espaces et la ponctuation", () => {
    const t = "Client : X.Y. INDUSTRIE - Villeneuve";
    const p = trouverTerme(t, "XY Industrie");
    expect(p).toHaveLength(1);
    expect(t.slice(p[0].debut, p[0].fin)).toBe("X.Y. INDUSTRIE");
    expect(trouverTerme("MÉCANIQUE DUPONT", "mecanique dupont")).toHaveLength(1);
    expect(trouverTerme("Fischer Antriebe GmbH, Straße 4", "strasse")).toHaveLength(1);
  });

  it("cherche les termes courts mot pour mot, sans faux positif dans un mot plus long", () => {
    expect(trouverTerme("Fischer AG", "AG")).toHaveLength(1);
    expect(trouverTerme("AGRAFE", "AG")).toHaveLength(0);
    expect(trouverTerme("Plan XY 12", "XY")).toHaveLength(1);
  });

  it("trouve une référence écrite avec ou sans tirets", () => {
    expect(trouverTerme("Réf. FA20417B ind. C", "FA-20417-B")).toHaveLength(1);
  });

  it("garde une correspondance exacte entre texte compact et texte d'origine", () => {
    const c = compacter("Ä-b");
    expect(c.compact).toBe("ab");
    expect(c.carte).toEqual([0, 2]);
  });
});

describe("motifs", () => {
  it("reconnaît e-mails, téléphones, TVA, mais pas une cote", () => {
    const t = "j.martin@dupont-meca.fr · +33 3 87 07 00 80 · TVA FR74513618157 · Ø25 h7 · 120 450 300";
    const m = trouverMotifs(t).map((x) => x.motif).sort();
    expect(m).toEqual(["email", "telephone", "tva"]);
  });

  it("ne prend un SIRET que derrière son libellé", () => {
    expect(trouverMotifs("SIRET 513 618 157 00012").map((x) => x.motif)).toContain("siret");
    expect(trouverMotifs("513 618 157 00012").map((x) => x.motif)).not.toContain("siret");
  });
});

describe("remplacerDansTexte", () => {
  it("remplace par le pseudonyme, le plus long terme d'abord", () => {
    const r = remplacerDansTexte("Dupont SAS, usine Dupont", [
      { valeur: "Dupont", pseudo: "CLIENT-B" },
      { valeur: "Dupont SAS", pseudo: "CLIENT-A" },
    ]);
    expect(r.texte).toBe("CLIENT-A, usine CLIENT-B");
    expect(r.remplacements).toHaveLength(2);
  });

  it("masque les motifs", () => {
    expect(remplacerDansTexte("Contact : a.b@exemple.fr", []).texte).toBe("Contact : [MASQUÉ]");
  });
});

describe("detecterSurSegments", () => {
  it("couvre un nom coupé en plusieurs mots par l'OCR", () => {
    const seg = [
      { texte: "Client:", x: 0.1, y: 0.9, w: 0.05, h: 0.01 },
      { texte: "DUPONT", x: 0.16, y: 0.9, w: 0.05, h: 0.01 },
      { texte: "SAS", x: 0.22, y: 0.901, w: 0.03, h: 0.01 },
      { texte: "Ø25", x: 0.5, y: 0.5, w: 0.03, h: 0.01 },
    ];
    const d = detecterSurSegments(seg, [{ valeur: "Dupont SAS", pseudo: "CLIENT-A" }], []);
    expect(d).toHaveLength(1);
    expect(d[0].x).toBeCloseTo(0.16);
    expect(d[0].x + d[0].w).toBeCloseTo(0.25);
  });

  it("mesure la couverture d'un rectangle", () => {
    expect(tauxCouverture({ x: 0, y: 0, w: 1, h: 1 }, [{ x: 0, y: 0, w: 0.5, h: 1 }])).toBeCloseTo(0.5, 1);
  });
});
