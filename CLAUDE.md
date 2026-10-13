# CLAUDE.md : EvMasque

Outil d'anonymisation des données de chiffrage (plans, STEP, tableurs) d'Evolia Stratégie. Cahier des charges : `docs/CAHIER-DES-CHARGES.md`. Réponds en français.

**Ce dépôt est public** (licence Apache 2.0). Le cadrage interne et l'historique commercial sont dans le dépôt de contexte privé d'Evolia, pas ici.

## Les non-négociables

1. **Aucune donnée ne quitte le navigateur.** Aucun `fetch` vers l'extérieur, aucune télémétrie, aucune police, aucun script ni aucune ressource chargés à distance. Le verrou réseau (CSP dans `vite.config.ts`) ne doit jamais être assoupli. Toute nouvelle ressource s'embarque (`?raw` pour du texte, `?b64` pour du binaire).
2. **Rien n'est stocké ailleurs que sur le poste**, et pas même dans le navigateur (ni `localStorage`, ni IndexedDB). Les sorties ne sont écrites que par l'utilisateur (sélecteur de dossier ou téléchargement).
3. **On reconstruit, on ne cache pas.** Plans : rendus en image, masques dans les pixels, PDF neuf. Tableurs : classeur neuf, valeurs seules. STEP : seules les chaînes changent, la géométrie est vérifiée identique.
4. **Double contrôle obligatoire** sur chaque fichier produit ; un fichier qui échoue est bloqué, jamais enregistré.
5. **La table de correspondance ne va jamais dans `A_ENVOYER`.**
6. **Le rapport envoyé ne contient aucune valeur d'origine.**
7. **Jamais de données réelles de prospect** dans le code, les tests ou le corpus : uniquement des noms fictifs.
8. **Rien de confidentiel dans le dépôt public** : ni nom de prospect ou de client, ni prix, ni note interne, ni compte rendu, dans le code, les commentaires, les tests, la documentation ou les messages de commit.

## Architecture

| Fichier | Rôle |
|---|---|
| `src/lib/texte.ts` | Normalisation, recherche de termes (forme compacte), motifs (e-mail, téléphone, TVA…), détection sur segments positionnés |
| `src/lib/dictionnaire.ts` | Pseudonymes déterministes, suggestions |
| `src/lib/inventaire.ts` | Types de fichiers, regroupement par pièce |
| `src/lib/moteurs.ts` | pdf.js sur le fil principal (décodeurs fournis par `BinaryDataFactory`), worker Tesseract d'un seul tenant (chargeur de langues + cœur + worker) |
| `src/lib/plans.ts` | Lecture, rendu, OCR des plans |
| `src/lib/masquage.ts` | Détections et masques par page |
| `src/lib/step.ts` | Anonymisation et intégrité STEP |
| `src/lib/tableur.ts` | Analyse et reconstruction des tableurs |
| `src/lib/sortie.ts` | Fabrication des PDF, contrôles |
| `src/lib/livrables.ts` | Table, collecte, rapport, mot de passe, archive AES, écriture |
| `src/etat.tsx` | État et orchestration |
| `src/ui/` | Les 5 étapes, l'aperçu, « Nos méthodes », « Chiffrement », l'aide |

## Pièges connus

- **Page ouverte en `file://`** : un worker ne peut pas `importScripts` un second blob. D'où le worker Tesseract en un seul script, et pdf.js sans worker.
- **tesseract.js 7** transmet `l.data` au lieu de `l.code` quand on passe des langues en objets : on passe des noms de langue, et le chargeur embarqué répond à la place de `fetch`.
- **Gabarits JavaScript** : `\s` ou `\/` y perdent leur antislash. Utiliser `String.raw` ou éviter les regex dans le code injecté.
- **Effets React** : un effet doit renvoyer une fonction ou rien (`useEffect(() => { … })`).
- **Verrou réseau écrit deux fois** : balise de la page (`vite.config.ts`) et en-tête HTTP du site (`vercel.json`). Un test vérifie qu'ils sont identiques : les modifier ensemble.
- **`THIRD-PARTY-NOTICES.txt`** est régénéré à chaque construction à partir des paquets réellement intégrés : le commiter quand une dépendance change.
- **Le script (≈ 14 Mo) est placé en fin de page** à la construction, pour que la présentation de `index.html` soit lue par les moteurs de recherche.

## Vérifier un changement

`npm run recette` doit rester vert : tests unitaires, construction, parcours complet sans requête réseau, contrôle indépendant des archives.
