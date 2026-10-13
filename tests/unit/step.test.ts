import { describe, expect, it } from "vitest";
import {
  anonymiserStep,
  decoderChaine,
  encoderChaine,
  fuitesStep,
  indicesStep,
  verifierIntegrite,
} from "../../src/lib/step";

const STEP = `ISO-10303-21;
HEADER;
/* Généré par SolidWorks pour DUPONT SAS */
FILE_DESCRIPTION(('Bride FA-20417-B'),'2;1');
FILE_NAME('C:\\\\Clients\\\\Dupont\\\\FA-20417-B.STEP','2026-03-12T10:22:41',('Jean Martin'),('DUPONT SAS'),
  'SwSTEP 2.0','SolidWorks 2022','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#1=APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);
#2=APPLICATION_CONTEXT('core data for automotive mechanical design processes');
#10=PRODUCT('FA-20417-B','Bride FA-20417-B Dupont','Pièce pour M\\X2\\00C9\\X0\\CANIQUE DUPONT',(#11));
#11=PRODUCT_CONTEXT('',#2,'mechanical');
#12=PRODUCT_DEFINITION_FORMATION('C','rev C de J. Martin',#10);
#13=PRODUCT_DEFINITION('design','',#12,#14);
#20=PERSON('JM','Martin','Jean',$,$,$);
#21=ORGANIZATION('D1','DUPONT SAS','Villeneuve');
#30=CARTESIAN_POINT('',(0.,25.4,-12.5));
#31=CARTESIAN_POINT('Origine Dupont',(1.E-3,2.5E2,0.));
#32=CONVERSION_BASED_UNIT('INCH',#33);
#40=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));
#50=DESCRIPTIVE_REPRESENTATION_ITEM('materiau','Acier 42CrMo4');
#51=SHAPE_REPRESENTATION('Body contact j.martin@dupont-meca.fr',(#30),#2);
ENDSEC;
END-ISO-10303-21;
`;

const TERMES = [
  { valeur: "DUPONT SAS", pseudo: "CLIENT-A" },
  { valeur: "Dupont", pseudo: "CLIENT-B" },
  { valeur: "Jean Martin", pseudo: "PERSONNE-01" },
  { valeur: "FA-20417-B", pseudo: "P-001" },
];

describe("STEP", () => {
  it("décode et réencode les chaînes", () => {
    expect(decoderChaine("M\\X2\\00C9\\X0\\CANIQUE l''usine")).toBe("MÉCANIQUE l'usine");
    expect(decoderChaine(encoderChaine("Été l'usine"))).toBe("Été l'usine");
  });

  it("repère produits, organisations et personnes", () => {
    const i = indicesStep(STEP);
    expect(i.produits).toContain("FA-20417-B");
    expect(i.organisations).toContain("DUPONT SAS");
    expect(i.personnes).toContain("Jean Martin");
  });

  const r = anonymiserStep(STEP, TERMES, ["email"], "P-001", "P-001_3d.step");

  it("retire toute trace d'identité, commentaires compris", () => {
    const fuites = fuitesStep(r.texte, TERMES, ["email"]);
    expect(fuites).toEqual([]);
    expect(r.texte).not.toMatch(/Dupont|DUPONT|Martin|SolidWorks|Clients/);
    expect(r.commentairesRetires).toBe(1);
    expect(r.texte.replace(/\s+/g, "")).toContain("FILE_NAME('P-001_3d.step','2000-01-01T00:00:00',(''),(''),'','','')");
    expect(r.texte).toContain("#10=PRODUCT('P-001','P-001','',(#11));");
  });

  it("conserve les valeurs techniques et la géométrie à l'identique", () => {
    expect(r.texte).toContain("FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'))");
    expect(r.texte).toContain("#13=PRODUCT_DEFINITION('design','',#12,#14);");
    expect(r.texte).toContain("CONVERSION_BASED_UNIT('INCH',#33)");
    expect(r.texte).toContain("'Acier 42CrMo4'");
    expect(r.texte).toContain("#31=CARTESIAN_POINT('Origine CLIENT-B',(1.E-3,2.5E2,0.));");
    const integrite = verifierIntegrite(STEP, r.texte);
    expect(integrite.ok).toBe(true);
  });

  it("détecte une altération de la géométrie", () => {
    const altere = r.texte.replace("25.4", "25.5");
    expect(verifierIntegrite(STEP, altere).ok).toBe(false);
  });
});
