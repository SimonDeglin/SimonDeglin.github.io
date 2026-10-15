# Marché Radar — Phase 3A : pilote de téléchargement et lecture d'un CSC

**Date :** 15 octobre 2026  
**Branche isolée :** `feature/marcheradar-phase3a-download-20261015`  
**Statut :** pilote technique réussi ; **non intégré à la collecte automatique de production**.

## Document testé

- Source : https://www.publicprocurement.be/publication-workspaces/0765b50e-85f5-4aae-b2ca-2ed66c14e354/documents
- Marché : « Mission de services de géomètre pour levés bathymétriques ».
- Pièce : `2026B0173_CCH - Bathymetrie Modele 3P_FR_F.pdf`.
- Méthode : ouverture de la rubrique Documents dans Chromium, menu d'action de la pièce, « Télécharger la dernière version », réception d'un téléchargement de type PDF.
- Taille récupérée : **773 732 octets**.
- Nombre de pages : **35**.
- Texte récupéré automatiquement : **97 572 caractères**.
- SHA-256 du PDF : `50b48856c509ac6d51a1c37bb745aba4c2d395221a7313312d467ed7d309f420`.
- Passages candidats repérés : **19** (échéances, critères, sélection).
- Aucune erreur d'extraction dans l'essai.

## Exemple de fait documenté

Sur **la page 11**, le CSC précise : « Le prix est l'unique critère d'attribution. ».

Le même passage indique que la date et l'heure limites de remise des offres sont précisées dans **l'invitation à remettre offre ou l'avis de marché**. **La date limite n'a pas été extraite ni vérifiée** par ce test.

Le test n'a pas permis d'établir un statut de visite des lieux. L'absence de mots clés n'est pas une preuve qu'aucune visite n'est requise.

## Règles de sécurité et de provenance

- Le PDF est téléchargé provisoirement sur le runner GitHub Actions, analysé puis supprimé.
- **Aucun PDF tiers** n'est ajouté au dépôt public ni aux artefacts de diagnostic.
- Les URLs de téléchargement du stockage temporaire **ne sont pas enregistrées** dans `data.json`.
- Les extraits ne sont pas automatiquement intégrés comme faits officiels sans vérification du document, de sa version et des rectificatifs.

## Tests

- [Observation du bouton de téléchargement](https://github.com/SimonDeglin/SimonDeglin.github.io/actions/runs/38760815956) : téléchargement PDF déclenché.
- [Lecture du PDF et extraction de texte](https://github.com/SimonDeglin/SimonDeglin.github.io/actions/runs/38761438090) : fichier valide et texte extrait.

## Suite recommandée

1. Transformer le pilote en un collecteur documentaire **réutilisable**, limité aux fichiers réellement accessibles.
2. Tester plusieurs CSC authentiques de types différents avant toute généralisation.
3. Enregistrer les faits utiles avec `documentId`, SHA-256, page, extrait, date d'extraction et statut de vérification.
4. Distinguer formellement les **échéances de procédure** des durées d'exécution, des dates d'invitation et des dates figurant dans les pièces.
5. Vérifier les rectificatifs et les versions avant d'annoncer une échéance ou une visite comme confirmée.
6. Exécuter les tests Chromium des Phases 1, 2 et 3A avant publication sur `main`.
