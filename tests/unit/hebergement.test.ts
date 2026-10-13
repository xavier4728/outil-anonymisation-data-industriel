import { describe, expect, it } from "vitest";
import config from "../../vite.config.ts?raw";
import vercel from "../../vercel.json?raw";

/** Les directives du verrou réseau inscrit dans la page, lues dans vite.config.ts. */
function directivesPage(): string[] {
  const bloc = config.slice(config.indexOf("const CSP = ["), config.indexOf('].join("; ")'));
  return [...bloc.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function enTete(nom: string): string {
  const regles = JSON.parse(vercel).headers as { source: string; headers: { key: string; value: string }[] }[];
  return regles.find((r) => r.source === "/(.*)")?.headers.find((h) => h.key === nom)?.value ?? "";
}

describe("hébergement (anonymisation.evoliastrategie.com)", () => {
  it("l'en-tête HTTP reprend exactement le verrou réseau de la page, plus l'interdiction d'être encadrée", () => {
    const page = directivesPage();
    expect(page).toContain("connect-src blob: data:");
    expect(enTete("Content-Security-Policy")).toBe([...page, "frame-ancestors 'none'"].join("; "));
  });

  it("ne transmet aucune adresse d'origine et ne se laisse pas afficher dans un cadre", () => {
    expect(enTete("Referrer-Policy")).toBe("no-referrer");
    expect(enTete("X-Frame-Options")).toBe("DENY");
  });

  it("reste indexable par les moteurs de recherche", () => {
    expect(enTete("X-Robots-Tag")).toBe("");
  });
});
