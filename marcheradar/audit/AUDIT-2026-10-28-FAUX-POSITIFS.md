# Formule administrative et faux positifs — 28 octobre 2026

Base : `90dcf1fc2226b865c39ffbf5948dbd6330209601`, après PR 11.

## Constat et correction

Le dictionnaire VRD comprenait « cahier spécial des charges » parmi les expressions de contexte. Cette seule formule pouvait qualifier en VRD un avis de vêtements, de leasing automobile, de logiciel ou de repas. Le titre et la description sont désormais évalués sans utiliser cette formule comme signal métier. Le dictionnaire reste intact. Une expression spécifique, telle que « cahier spécial des charges voirie », conserve son effet.

Les autres critères métier et les pistes communales restent applicables. Un GIS au titre sommaire demeure à vérifier ; les études de voirie, missions de géomètre, certifications PEB et petits travaux hydrométriques conservent leurs règles. Aucun diagnostic de capacité KDRIX n'est déduit de ce filtre.

## Historique conservé

Sur les 158 dossiers présents à la base, 29 avis auparavant retenus sans autre signal métier passent au classement automatique `excluded`, avec motif `formule_administrative_sans_signal_metier`. Seuls ces deux champs changent. Les 158 identifiants, titres, sources, échéances, pièces, analyses et autres champs sont conservés. Aucun stockage utilisateur, note, favori ou classement manuel n'est modifié. La collecte TED réapplique le même critère aux données historiques lors de ses prochaines passes ; TED et BOSA l'appliquent également aux nouveaux avis.

## Validation

68 tests unitaires réussis, ainsi que les quatre scripts de contrôle des collecteurs. Régressions dédiées : formule seule au titre ou dans la description, casse et accents, maintien de signaux métier valides, préservation du dossier lors de la requalification. Contrôle structurel de la base : mêmes 158 identifiants et champs inchangés hors classement automatique des 29 dossiers concernés. Le workflow de PR exécute aussi les parcours Chromium existants avant publication.

## Limites et suite

Cette correction retire une cause identifiée de faux positifs. Elle ne certifie ni la pertinence de tous les avis restants ni la capacité de KDRIX à soumissionner. Les mots de contexte, les missions mixtes de conception et exécution et les titres peu précis nécessitent encore une lecture. Restent l'analyse sourcée des CSC et annexes, les exigences de sélection et références, la qualification selon les moyens réels de KDRIX et l'élargissement de la couverture documentaire.

Retour arrière : rétablir le profil et les seuls champs de classement concernés sans restaurer une ancienne base entière.
