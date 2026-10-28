# Marché Radar — audit et fiabilité du 28 octobre 2026

## Référence et préservation

Référence initiale : `d4a1d888cb4e2c65e3033c26cd599d9379c901b6` sur `main`.
Intervention limitée à Marché Radar et à son workflow de validation. `data.json`, les identifiants historiques, les autres modules et les clés de stockage sont conservés.

Base auditée : 150 marchés (74 BOSA, 41 TED, 35 pistes locales), 41 dates limites renseignées dont 5 vérifiées par concordance BOSA. 24 dossiers disposent d'un inventaire documentaire ; 4 analyses PDF concernent 3 dossiers. Ces nombres décrivent les données présentes et ne garantissent ni exhaustivité ni actualité officielle.

## Tests de l'état publié avant modification

Test interactif du site public : chargement des 150 marchés ; clic sur un titre → aperçu actualisé sans ouverture de fiche ; exclusion Hors sujet ; rechargement ; accès au marché exclu ; réintégration ; ouverture explicite de la grande fiche. Les actions de test ont été annulées par réintégration.
39 tests unitaires existants réussis. L'installation locale de Chromium a échoué sur un téléchargement tronqué ; les tests complets de navigateur sont exécutés dans GitHub Actions.

## Corrections

- Un clic sur un titre sélectionne une seule fois l'aperçu et remet son défilement interne en haut pour laisser le nouveau titre visible. Sur petit écran, l'aperçu est amené immédiatement dans la zone visible. La fiche complète garde ses boutons explicites.
- Le dossier Hors sujet reste accessible même si tous les métiers du marché sont masqués dans les préférences. Les décisions et notes existantes restent sous `kdrix.marcheRadar.v1`.
- Monitoring et Relief ne sont plus perdus par la normalisation des catégories à l'affichage.
- Une heure limite déjà dépassée aujourd'hui affiche « Date dépassée », au lieu de « Aujourd'hui ».
- BOSA/TED : un identifiant déjà connu prime sur les rapprochements secondaires. BOSA : suppression du rapprochement par référence seule entre acheteurs différents ; références ambiguës ou procédures explicitement différentes gardées séparées. Les rectificatifs reconnus gardent l'ID initial.
- Lecture rapide : grille dépliable prestations/livrables, délais documentaires, attribution, sélection, références, contraintes et visites. Extraits avec fichier et page ; absence marquée « Non documenté ». Seules les versions présentes dans l'inventaire courant sont affichées. Référence et lien de publication officielle accessibles.
- Extraction PDF : ajout des références et contraintes (coordonnées, précision, bilinguisme, matériel, formats), élargissement des livrables, réservation d'une place par rubrique pour éviter que le prix ou les dates monopolisent les extraits. Aucun extrait ne devient une obligation vérifiée.
- Détection : lieu wallon explicite prioritaire sur le siège flamand d'un acheteur. Les autres exclusions existantes sont conservées.
- Veille communale : le collecteur progressif planifié privilégie désormais la proximité quand les dates de contrôle sont identiques, en conservant toutes les zones. Dans le collecteur historique, les estimations de trajet ne retirent plus définitivement les communes extérieures de la rotation. Les sites non contrôlés depuis le plus longtemps et, à égalité, les plus proches restent prioritaires. Aucun temps de route réel n'est prétendu calculé.
- Cache des scripts et styles concernés renouvelé à la publication.

## Validation

Tests unitaires et collecteurs locaux : réussis. Régressions supplémentaires sur les fusions, rectificatifs successifs, conservation de tous les identifiants réels et preuve documentaire.
La CI de cette intervention exécute la totalité des tests unitaires, les quatre scripts collecteurs, le cockpit sous Chromium (ordinateur/mobile, préférences masquantes, notes, exclusion/réintégration, rechargement et mode dégradé), le suivi Phase 1 et les fiches Phase 2.
Une première exécution a validé cockpit et suivi ; le test Phase 2 attendait un nom de script sans paramètre de cache. Son assertion et son interception réseau ont été adaptés pour tester également le script versionné.

## Limites et suite

- Décisions, favoris et notes : stockage local au navigateur, sans synchronisation ni sauvegarde partagée. Effacer le stockage ou changer de navigateur perd cet accès aux décisions. Aucun contenu interne n'est envoyé dans le dépôt public.
- Un avis dépourvu de tout identifiant/référence de rapprochement fiable peut encore former un autre dossier. Pas de fusion approximative par titre, ni de suppression automatique des doublons historiques.
- La nouvelle extraction s'applique aux prochaines lectures de PDF ; les quatre analyses déjà enregistrées restent intactes. La couverture documentaire est partielle ; Word/Excel et documents protégés ne sont pas ajoutés dans cette intervention.
- Le lecteur communal planifié ne relit pas un PDF déjà marqué comme lu si son URL reste identique : les remplacements de contenu à URL constante ne sont donc pas encore détectés. Ce point reste à traiter avec versionnement et préservation des décisions.
- Les sources externes n'ont pas été toutes recollectées en direct pendant cet audit. Le dernier succès enregistré et les erreurs des sources restent les indicateurs de la collecte. La couverture communale se construit progressivement ; un site répertorié n'est pas nécessairement surveillé avec succès.
- Les temps autour de Liège sont géographiques et estimatifs, sans trafic ni itinéraire validé. La zone d'environ deux heures sert à prioriser, pas à affirmer une durée réelle.
- L'analyse automatique repère des passages ; elle ne certifie pas la faisabilité KDRIX, les références disponibles ou le caractère obligatoire d'une clause. La lecture du CSC et de ses rectificatifs reste nécessaire.
- Les fonctions historiques redondantes du script principal sont conservées pour limiter le risque ; une consolidation ultérieure doit rester testée séparément.

Retour arrière : rétablir les seuls fichiers de code de cette intervention depuis la référence initiale, sans restaurer `data.json` et sans effacer le stockage du navigateur.
