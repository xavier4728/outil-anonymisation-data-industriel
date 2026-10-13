# EvMasque

**Anonymisez vos plans et vos données de chiffrage sans qu'ils quittent votre poste.**

👉 **[anonymisation.evoliastrategie.com](https://anonymisation.evoliastrategie.com)** · gratuit · sans compte · code source ouvert (Apache 2.0)

EvMasque retire des plans PDF, des scans, des fichiers STEP et des études Excel tout ce qui identifie les clients d'une entreprise industrielle (raisons sociales, références, noms, adresses, coordonnées) sans abîmer ce qui sert au chiffrage. Les fichiers peuvent ensuite être confiés à un tiers, pour un essai ou une consultation, sans exposer les donneurs d'ordres.

Tout le traitement se fait **dans le navigateur**. EvMasque est une page HTML autonome d'environ 15 Mo : code, moteurs de lecture, langues de l'OCR et polices y sont inclus. Aucun fichier n'est envoyé, ni stocké, nulle part.

## Ce que produit EvMasque

| Dossier | Contenu | Destination |
|---|---|---|
| `A_ENVOYER` (archive chiffrée AES-256) | Fichiers anonymisés renommés `P-001_plan.pdf`, `P-001_3d.step`…, fichier de collecte, rapport d'anonymisation | Le destinataire |
| `A_GARDER` | Table de correspondance (pseudonymes ↔ vraies valeurs), rapport, réglages | **Reste chez vous** |

Le mot de passe de l'archive est tiré au hasard dans le navigateur, affiché une fois, jamais enregistré. L'archive s'ouvre avec [7-Zip](https://www.7-zip.org/).

## Les garanties, et comment les vérifier

| Garantie | Comment c'est obtenu | Comment le vérifier |
|---|---|---|
| **Rien ne quitte le poste** | Verrou réseau `Content-Security-Policy` : `default-src 'none'`, `connect-src blob: data:`. Le navigateur lui-même interdit toute connexion sortante, même en cas d'erreur dans notre code | Couper le réseau après ouverture de la page : l'outil fonctionne. Onglet Réseau des outils de développement (F12) : aucune requête pendant le traitement |
| **Rien n'est stocké** | Ni `localStorage`, ni IndexedDB, ni cookie. Les sorties ne sont écrites que par l'utilisateur, dans le dossier qu'il choisit | Fermer l'onglet efface tout |
| **On reconstruit, on ne cache pas** | Plans redessinés en image (300 points par pouce), masques peints dans les pixels, PDF neuf. Tableurs reconstruits valeurs seules. STEP : seules les chaînes de texte changent | Les PDF produits ne contiennent aucun caractère de texte ni métadonnée |
| **Double contrôle** | Chaque fichier produit est relu : texte, métadonnées, couverture de chaque occurrence par un masque, géométrie STEP identique, tableur relu cellule par cellule. Un fichier qui échoue est bloqué | Rapport d'anonymisation joint au paquet, avec l'empreinte SHA-256 de chaque fichier |
| **La table de correspondance ne part jamais** | Rangée à part, dans `A_GARDER`, exclue du paquet par construction | Ouvrir l'archive : elle n'y est pas |

La page « Nos méthodes » de l'outil détaille tout cela pour un utilisateur non technique.

## Formats

PDF (vectoriels et scannés, y compris CCITT, JBIG2, JPEG 2000), TIF multipages, JPG, PNG, STEP (AP203, 214, 242), Excel (xlsx, xlsm, xls), ODS, CSV. OCR en français, allemand et anglais. Testé sous Chrome et Edge ; Firefox et Safari enregistrent par téléchargement.

## Utiliser EvMasque hors ligne

Pour une DSI qui préfère ne dépendre d'aucun site : récupérer le fichier [index.html](https://anonymisation.evoliastrategie.com/index.html) (clic droit › « Enregistrer le lien sous »), ou le construire depuis ce dépôt (`npm run build`), puis l'ouvrir dans Chrome ou Edge, réseau coupé si l'on veut. C'est le même fichier unique que celui du site.

## Développement

```bash
npm install
npm run dev        # serveur de développement (sans le verrou réseau)
npm test           # tests unitaires (vitest)
npm run build      # produit dist/index.html, fichier unique, et dist/licences-tiers.txt
npm run recette    # tests + construction + corpus fictif + parcours complet + contrôle indépendant
```

La recette génère un corpus **fictif** (`scripts/generer-corpus.py`), joue le parcours complet dans Chromium (Playwright), échoue à la moindre requête réseau, puis rouvre les archives produites avec d'autres bibliothèques (déchiffrement AES indépendant en `node:crypto`, pypdf, openpyxl) pour y chercher les valeurs d'origine. Elle demande Node 24 et [uv](https://docs.astral.sh/uv/) pour la partie Python.

Le site est hébergé sur Vercel (`vercel.json`), qui ajoute le verrou réseau en en-tête HTTP. L'hébergeur ne fait que livrer la page.

Architecture, règles et pièges connus : [CLAUDE.md](CLAUDE.md). Cahier des charges, critères d'acceptation et limites : [docs/CAHIER-DES-CHARGES.md](docs/CAHIER-DES-CHARGES.md).

## Licence

Code sous licence [Apache 2.0](LICENSE), © 2026 EVOLIA STRATÉGIE SAS. EvMasque intègre des bibliothèques libres (pdf.js, Tesseract.js, pdf-lib, SheetJS, zip.js, UTIF.js, React, polices Inter et JetBrains Mono) : leurs licences sont reproduites dans [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt).

## À propos

EvMasque est développé par [Evolia Stratégie](https://www.evoliastrategie.com), partenaire IA des PME et ETI industrielles : [devis et chiffrage automatisés](https://www.evoliastrategie.com/pme/devis-automatise), [pré-audit IA](https://audit.evoliastrategie.com), développements sur mesure, modèles ouverts et hébergement souverain. [LinkedIn](https://www.linkedin.com/company/107750556/) · contact@evoliastrategie.com
