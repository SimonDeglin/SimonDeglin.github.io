# Marché Radar — Phase 3B : premiers PDF analysés automatiquement

**Statut :** livrable limité à un lot pilote, contrôlé en CI avant publication.  
**Objectif :** passer des *fichiers répertoriés* à des *passages effectivement extraits* de documents PDF authentiques.

## Lecture réelle

Le navigateur Chromium a utilisé l'action publique « Télécharger la dernière version » dans les dossiers BOSA. Les fichiers ont été temporairement enregistrés, contrôlés par leur signature PDF, puis lus avec Poppler (`pdfinfo`, `pdftotext`). Les originaux sont supprimés à la fin de chaque traitement.

| Marché | Pièce analysée | Pages | Texte extrait |
|---|---|---:|---:|
| Bruxelles Environnement — Levés bathymétriques | CSC FR | 35 | 97 572 caractères |
| Bruxelles Environnement — Levés bathymétriques | Catalogue de clauses topographiques | 244 | 370 243 caractères |
| Ottignies — Mesurage et précadastration | Invitation à remettre offre | 6 | 11 143 caractères |
| VLAIO — BIZGIS phase 3 | Document de marché NL | 47 | 120 858 caractères |

**4 fichiers PDF réellement téléchargés et lus, répartis sur 3 dossiers BOSA.** La lecture de l'invitation d'Ottignies a réussi, mais les règles de détection n'y ont pas identifié de passage suffisamment précis : aucun fait n'a donc été inventé.

Le CSC bathymétrique comporte notamment, à la page 11, une indication selon laquelle le prix est le seul critère d'attribution. Cette mention est affichée comme **extrait automatique à vérifier**, avec renvoi à la rubrique Documents du dossier BOSA. Le fichier source est identifié par son `documentId`, `versionId`, son nombre de pages et son empreinte SHA-256.

## Données et sécurité

- Les passages extraits sont **courts**, associés à une page et au fichier exact.
- **Aucun texte intégral de CSC, aucune copie de PDF, aucun lien MinIO temporaire** n'est publié dans le dépôt.
- Les catégories « délai », « visite », « attribution », « sélection », « prestations » sont des **indices de texte**, pas des faits confirmés.
- **Aucun champ `deadline`, `visit` ou `requirements` n'est modifié** à partir de mots-clés.
- Une nouvelle version d'une pièce rend les extraits de l'ancienne version inactifs dans la fiche ; l'analyse est refaite avant affichage.
- Le moteur est idempotent : même fichier et mêmes passages = pas de nouvelle écriture ni de changement artificiel de date.
- Les notes personnelles et les dossiers KDRIX restent dans le navigateur et ne sont pas modifiés.

## Validation technique

- Téléchargement réel : quatre fichiers disponibles publiquement dans e-Procurement.
- Contrôles unitaires : preuve de version, SHA-256, pagination, échec de PDF invalide, protection HTML et absence d'inférences.
- Contrôles Chromium : 64 marchés présents, déplacements entre dossiers, comptes, recherche, affichage responsive des fiches.
- Contrôle des fusions TED/BOSA : les champs `documentAnalyses` sont conservés.

## Limites

Ce pilote n'extrait pas encore automatiquement toutes les échéances ou obligations depuis les documents. Les pièces peuvent être complétées par des rectificatifs. Leur lecture et la confirmation officielle des dates restent à développer.

Une généralisation devra limiter la charge du portail, filtrer les documents utiles, tenir compte des authentifications et traiter les PDF image ou les DOCX/XLSX avec des moteurs adaptés.
