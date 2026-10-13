# EvMasque : cahier des charges (version 1.1.0)

Ce document décrit ce que fait EvMasque et comment on vérifie qu'il le fait.

## 1. Contexte et cas d'usage

Pour tester un outil de chiffrage automatique, un usineur doit confier des données réelles : plans, fichiers STEP, études de chiffrage, temps réels. Ces données appartiennent en partie à **ses clients**. Il prépare seul, sans accompagnement, quelques dizaines de dossiers de pièces. EvMasque retire tout ce qui identifie ses clients, sans abîmer ce qui sert au chiffrage, et produit un paquet à envoyer, plus une table de correspondance qu'il garde.

## 2. Contraintes

| Contrainte | Réponse |
|---|---|
| Aucun accompagnement | Parcours guidé en 5 étapes, aide intégrée, suggestions automatiques, valeurs par défaut sûres |
| Service informatique qui bloque les exécutables | Page HTML autonome, aucune installation |
| Rien n'est stocké ailleurs que chez le client, même chiffré | Traitement dans l'onglet, verrou réseau, aucun stockage navigateur, écriture uniquement par l'utilisateur |
| Plans de clients étrangers | OCR français, allemand et anglais |
| Méthodes exposées et vérifiables | Page « Nos méthodes », verrou vérifiable (réseau coupé), code source publié |

## 3. Périmètre

**Pris en charge** : PDF (vectoriels, scannés CCITT / JBIG2 / JPEG 2000 / JPEG), TIF multipages, JPG, PNG, STEP (AP203 / 214 / 242), xlsx, xlsm, xls, ods, csv.
**Hors périmètre** : mails (.msg / .eml), DXF / DWG, CAO native, Word.

## 4. Exigences de sécurité

1. **Verrou réseau** : `Content-Security-Policy` avec `default-src 'none'` et `connect-src blob: data:`, inscrit dans la page et, sur le site hébergé, répété en en-tête HTTP avec `frame-ancestors 'none'`. Le chargeur de langues du worker OCR refuse toute URL.
2. **Aucune persistance** : ni `localStorage`, ni IndexedDB, ni cookie. Fermer l'onglet efface tout.
3. **Originaux en lecture seule.**
4. **Reconstruction** :
   - plans redessinés en image (300 points par pouce, plafonné à 36 Mpx par page, jamais au-delà de la résolution source), masques peints dans les pixels, PDF neuf (pdf-lib), métadonnées neutres (créateur et producteur « EvMasque », dates du 01/01/2000) ;
   - tableurs reconstruits valeurs seules ;
   - STEP réécrit chaîne par chaîne.
5. **Double contrôle** : PDF produit relu (zéro caractère de texte, métadonnées vides, aucune pièce jointe) ; couverture de chaque occurrence détectée par un masque (au moins 95 % de sa surface) ; STEP (structure identique, aucun terme) ; tableur relu cellule par cellule ; nom de fichier. **Fichier bloqué en cas d'échec.**
6. **Archive chiffrée** WinZip AES-256 (zip.js), mot de passe aléatoire de 5 × 4 caractères sans ambiguïté (100 bits), affiché une fois, jamais enregistré.
7. **Table de correspondance** uniquement dans `A_GARDER`.

## 5. Parcours

| Étape | Contenu |
|---|---|
| 1. Vos fichiers | Dépôt d'un dossier (glisser ou sélectionner) ou de fichiers ; regroupement par pièce (sous-dossier, sinon début du nom) modifiable ; fichiers non pris en charge listés ; reprise d'un projet enregistré |
| 2. Ce qu'il faut masquer | Dictionnaire (pseudonyme neutre `MASQUE-001`, ou `P-001` pour une référence de pièce) ; références des pièces ajoutées d'office ; suggestions (raisons sociales, libellés client / Kunde / dessiné par, n° de plan, domaines d'e-mail, en-têtes STEP) ; coordonnées automatiques ; colonnes de prix retirées par défaut ; feuilles masquées exclues par défaut ; OCR renforcé en option |
| 3. Zone commune aux plans | Une zone par format de page (le cartouche), proposée par défaut (190 × 60 mm en bas à droite), modifiable, appliquée à tous les plans du format |
| 4. Retouche plan par plan | Aperçu avant / après de chaque page, masques activables, ajouts manuels, remplacements STEP et tableur listés ; **validation explicite de chaque fichier** |
| 5. Envoi | Production ; enregistrement (sélecteur de dossier, sinon deux téléchargements), mot de passe et marche à suivre ; tableau du double contrôle |
| Page « Chiffrement » | Ce qui est chiffré, le mot de passe, l'envoi en deux chemins, l'ouverture avec 7-Zip |

Le dictionnaire n'a pas de catégorie (client, personne…) : sur des plans lus par OCR, une catégorie devinée se trompe trop souvent, et un pseudonyme neutre en dit moins sur la valeur d'origine.

## 6. Détection

- **Termes** : comparaison sur forme compacte (minuscules, sans accents, lettres et chiffres seuls) pour les termes de 5 caractères et plus ; mot pour mot en dessous (« AG », « SA »).
- **Motifs** : e-mail, URL, téléphone (FR, DE, CH, BE, IT, AT, UK), TVA intracommunautaire, SIREN / SIRET / HRB après leur libellé uniquement, IBAN après son libellé.
- **Sur les plans** : texte natif du PDF (positions exactes, rotations comprises) ; OCR si la page a moins de 20 caractères de texte (scans, textes vectorisés) ou en lecture renforcée ; on masque le segment entier touché, avec une marge.

## 7. Livrables

| Fichier | Destination | Contenu |
|---|---|---|
| `P-xxx/P-xxx_plan.pdf`, `_3d.step`, `_tableur.xlsx` / `.csv` | `A_ENVOYER` | Fichiers anonymisés |
| `fichier-de-collecte.xlsx` | `A_ENVOYER` | Une ligne par pièce (plans, 3D, étude préremplis ; matière, quantité, machines, temps réels à compléter), feuilles « Essai » et « Consignes » |
| `rapport-anonymisation.html` | les deux | Traitement et contrôles par fichier, empreintes SHA-256, aucune valeur d'origine |
| `table-de-correspondance.xlsx` | `A_GARDER` | Pièces et termes ↔ pseudonymes |
| `projet-evmasque.json` | `A_GARDER` | Dictionnaire, zones, options (contient les termes d'origine) |
| `LISEZ-MOI.txt` | `A_GARDER` | Ce qui part, ce qui reste |

## 8. Design

Charte Evolia Stratégie : thème clair, noir et blanc, Inter et JetBrains Mono, angles droits. Quelques couleurs fonctionnelles seulement : bleu pour les liens, vert pour valider et pour ce qui est conforme, ambre pour signaler, rouge pour retirer ou bloquer. Vocabulaire de l'usineur.

## 9. Critères d'acceptation et preuves

La recette (`npm run recette`) rejoue tout sur un corpus **fictif** généré par `scripts/generer-corpus.py`.

| Critère | Preuve |
|---|---|
| Aucune requête réseau pendant un parcours complet | 0 requête (Playwright, page ouverte en `file://`) |
| Aucune valeur d'origine dans le paquet envoyé | Contrôle indépendant (pypdf, openpyxl, recherche sur forme normalisée) |
| Plans produits sans texte ni métadonnée | 0 caractère, métadonnées neutres |
| Archive conforme WinZip AES-256, refusée sans le bon mot de passe | Déchiffrée et authentifiée par un code indépendant (`node:crypto`) |
| STEP : géométrie identique | Structure et valeurs numériques identiques |
| Colonnes de prix retirées, feuille masquée écartée | Relecture du classeur produit |
| Table de correspondance absente du paquet | Inventaire de l'archive |
| Scans CCITT, TIF allemand multipage, photo JPG lus par OCR | Termes trouvés et masqués |
| Verrou réseau identique dans la page et dans l'en-tête HTTP | Test unitaire |

EvMasque a aussi été éprouvé sur un lot de plans réels, de bout en bout, enregistrement par sélecteur de dossier et ouverture de l'archive avec 7-Zip compris. Ces plans ne sont évidemment pas dans le dépôt.

## 10. Limites connues

- **Références de pièce très courtes** tirées des noms de fichiers (« D », « PLN ») : masquées d'office, elles noircissent toutes leurs occurrences isolées sur les plans (une coupe « D-D », un indice D). Pas de fuite, mais un masquage excessif possible : à surveiller à l'étape 4.
- **Formats lus mais non couverts par la recette** : xls, ods, PDF en JBIG2 et JPEG 2000 (le CCITT est testé). Firefox et Safari non testés : ils enregistrent par téléchargement.
- **Plans encodés en JPEG à 92 %** dans le PDF de sortie : léger, rapide, lisible à 300 points par pouce, mais avec perte.
- **pdf.js tourne sur le fil principal** : l'interface peut se figer brièvement pendant le rendu d'un très gros plan.
- **Hébergement** : la page est servie par Vercel depuis ce dépôt (`vercel.json`). L'hébergeur ne sert que la page : il voit les visites, jamais les fichiers, que le verrou réseau empêche d'envoyer.
