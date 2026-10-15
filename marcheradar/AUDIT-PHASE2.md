# Marché Radar V2 — Phase 2 : fiche détaillée et accès aux sources

**Date :** 15 octobre 2026  
**Branche de développement :** `feature/marcheradar-v2-phase2-20261015`  
**Base initiale :** version de production issue de la Phase 1 (commit `bc52a3b7bbe04538da3ff9da74fbab12da9a7b4c`).

## Portée et limites

L'application conserve ses **64 marchés** : 14 TED, 16 BOSA, 34 LOCALE au moment de l'audit. Dans les données existantes, 15 disposent d'une date limite, 49 n'en disposent pas. Aucun des 64 marchés ne comporte actuellement une fiche structurée de visite `visit` avec preuve ni une liste structurée de fichiers `documents` issue d'un cahier spécial des charges.

**La Phase 2 est une refonte de consultation, pas encore l'extraction automatique de tous les cahiers spéciaux des charges** (celle-ci est prévue en Phase 3).

## Développement

- `marcheradar/detail-phase2.js` : module autonome de présentation des informations, dates, sources, visites et exigences, avec échappement HTML et rejet des liens dangereux.
- `marcheradar/detail-phase2.css` : fiche plus large et sections de lecture distinctes, affichage adapté aux écrans étroits.
- `marcheradar/index.html` : intégration ciblée, sans refonte des listes ni du stockage local.
- `marcheradar/tests/phase2-module.test.cjs` : tests unitaires des provenances, échéances, titres, documents, visites et informations incertaines.
- `marcheradar/tests/phase2-browser.cjs` : test fonctionnel dans Chromium, y compris données réelles, source communale, mobile, persistance de notes et filtres.
- `.github/workflows/marcheradar-phase2-tests.yml` : validation automatique des Phases 1 et 2 à chaque modification du module.

### Information affichée

- En tête : intitulé, source, type d'avis, statut de réponse/prospection, description.
- Identification : acheteur, référence, zone, publication, échéance telle que publiée, CPV, procédure, délai si connu.
- Visite : **non vérifiée** par défaut ; **mention à contrôler** si un indice figure dans les données ; **obligatoire/facultative/absente** uniquement si un champ structuré `visit` comporte preuve, URL et vérification explicite.
- Documents : publication TED, dossier BOSA/e-Procurement, document communal ; les liens `documents` sont affichés lorsqu'ils existent réellement dans les données. Une page e-Procurement n'est **pas** présentée comme un cahier des charges téléchargé.
- Conditions : les exigences sont présentées comme non analysées jusqu'à ce que des données documentées soient présentes ; les contraintes déjà signalées sont distinguées des exigences vérifiées.
- Notes et classement : même stockage `localStorage`, pas de modification des identifiants, classement conservé.

## Tests

**Workflow validé sur branche isolée :** [Tests Phase 2](https://github.com/SimonDeglin/SimonDeglin.github.io/actions/runs/38737053321).

Résultats :
- Tests unitaires : succès (aucune erreur).
- Tests Chromium Phase 1 : 64 marchés chargés, classement, compteurs, filtres, stockage et retour : succès.
- Tests Chromium Phase 2 : TED, BOSA, document communal, avis de résultat, liens source, visite avec preuve et visite sans preuve, champs inconnus, contre-exemples XSS, notes, classement et affichage mobile : succès.
- Captures produites dans l'artefact `marcheradar-phase2-captures` de ce workflow, pour revue visuelle complémentaire.

## Limitations explicites

- **Aucune extraction en masse des visites, documents et critères d'attribution** n'est annoncée dans cette phase.
- Le fonctionnement des portails TED/e-Procurement ou leurs éventuelles authentifications n'est pas garanti par les tests locaux ; les liens sont ceux présents dans les données collectées.
- Un PDF communal ancien peut rester affiché comme source d'une prospection historique. Sa pertinence actuelle doit être contrôlée, sans le présenter comme un appel d'offres actif.
- Les fonctions historiques définies deux fois dans le fichier HTML sont conservées afin d'éviter une régression non testée. Leur rationalisation relèvera d'une intervention distincte.
- Les statuts et notes restent **locaux au navigateur**, non partagés entre collaborateurs.

## Publication et retour arrière

Fusionner sur `main` uniquement après succès des tests. Après fusion, confirmer l'état GitHub Pages et relancer les tests sur `main`. En cas de régression, restaurer la version précédente de `marcheradar/index.html` et supprimer les références aux deux ressources Phase 2 ; **ne pas écraser `marcheradar/data.json` ni les classements stockés chez l'utilisateur**.
