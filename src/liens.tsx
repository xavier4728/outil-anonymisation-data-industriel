/** Liens externes d'EvMasque. Ils s'ouvrent dans un nouvel onglet : le travail en cours, gardé en mémoire, n'est pas perdu. */
import type { ReactNode } from "react";

export const LIENS = {
  site: "https://www.evoliastrategie.com",
  devis: "https://www.evoliastrategie.com/pme/devis-automatise",
  audit: "https://audit.evoliastrategie.com",
  linkedin: "https://www.linkedin.com/company/107750556/",
  code: "https://github.com/xavier4728/outil-anonymisation-data-industriel",
  licence: "https://github.com/xavier4728/outil-anonymisation-data-industriel/blob/main/LICENSE",
  licencesTiers: "https://anonymisation.evoliastrategie.com/licences-tiers.txt",
};

export function Externe({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
