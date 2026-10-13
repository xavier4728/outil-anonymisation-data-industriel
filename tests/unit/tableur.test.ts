import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { analyserTableur, anonymiserTableur, estColonnePrix, fuitesTableur } from "../../src/lib/tableur";

function classeur(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  wb.Props = { Author: "Jean Martin", Company: "DUPONT SAS", Title: "Etude FA-20417-B" };
  const etude = XLSX.utils.aoa_to_sheet([
    ["Client :", "DUPONT SAS"],
    ["Contact", "j.martin@dupont-meca.fr"],
    [],
    ["Opération", "Machine", "Temps réglage (min)", "Temps cycle (s)", "Taux horaire (€/h)", "Prix unitaire", "Marge", "Temps total"],
    ["Tournage", "Tornos DT26", 45, 38.5, 68, 4.2, 0.25, 120],
    ["Fraisage FA-20417-B", "Robodrill", 30, 22, 72, 3.1, 0.25, 80],
  ]);
  XLSX.utils.book_append_sheet(wb, etude, "Etude Dupont");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Tarif DUPONT", 1.5]]), "Tarifs");
  wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const TERMES = [
  { valeur: "DUPONT SAS", pseudo: "CLIENT-A" },
  { valeur: "Dupont", pseudo: "CLIENT-B" },
  { valeur: "FA-20417-B", pseudo: "P-001" },
];

describe("tableurs", () => {
  it("distingue les colonnes de prix des colonnes de temps", () => {
    expect(estColonnePrix("Taux horaire (€/h)")).toBe(true);
    expect(estColonnePrix("Prix unitaire")).toBe(true);
    expect(estColonnePrix("Marge")).toBe(true);
    expect(estColonnePrix("Temps total")).toBe(false);
    expect(estColonnePrix("Temps cycle (s)")).toBe(false);
    expect(estColonnePrix("Machine")).toBe(false);
  });

  const analyse = analyserTableur(classeur(), "xlsx");

  it("analyse en-têtes, feuilles masquées et valeurs client", () => {
    const etude = analyse.feuilles[0];
    expect(etude.ligneEntete).toBe(3);
    expect(etude.colonnesPrix).toEqual([4, 5, 6]);
    expect(analyse.feuilles[1].masquee).toBe(true);
    expect(analyse.valeursClient).toContain("DUPONT SAS");
  });

  it("reconstruit un classeur sans identité, sans prix, sans feuille masquée", () => {
    const r = anonymiserTableur(analyse, "xlsx", TERMES, ["email"], {
      inclureMasquees: false,
      colonnesRetirees: { "Etude Dupont": analyse.feuilles[0].colonnesPrix },
    });
    expect(fuitesTableur(r.octets, "xlsx", TERMES, ["email"])).toEqual([]);
    expect(r.feuillesRetirees).toHaveLength(1);
    expect(r.colonnesRetirees).toHaveLength(3);

    const relu = XLSX.read(r.octets, { type: "array" });
    expect(relu.SheetNames).toEqual(["Etude CLIENT-B"]);
    const lignes = XLSX.utils.sheet_to_json<unknown[]>(relu.Sheets[relu.SheetNames[0]], { header: 1 });
    expect(lignes[3]).toEqual(["Opération", "Machine", "Temps réglage (min)", "Temps cycle (s)", "Temps total"]);
    expect(lignes[4]).toEqual(["Tournage", "Tornos DT26", 45, 38.5, 120]);
    expect(lignes[5][0]).toBe("Fraisage P-001");
    expect(relu.Props?.Author).toBe("EvMasque");
    expect(JSON.stringify(relu.Props)).not.toMatch(/Martin|DUPONT/);
  });

  it("ne prend pas l'en-tête d'un CSV pour un nom de client", () => {
    const csv = new TextEncoder().encode(["OF;Kunde;Zeichnungs-Nr.;Temps réel (s)", "OF1;Antriebe Musterfirma GmbH;KL-5502;41,2", ""].join("\n"));
    const a = analyserTableur(csv.buffer, "csv");
    expect(a.valeursClient).toEqual(["Antriebe Musterfirma GmbH"]);
  });
});
