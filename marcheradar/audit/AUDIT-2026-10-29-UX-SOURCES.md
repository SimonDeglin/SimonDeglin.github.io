# Lecture rapide et visibilité des collectes — 29 octobre 2026

Base : `505291df8d358368bf93f3437a78443dff7e8ac3`. Intervention limitée à Marché Radar et à ses workflows. Les 159 dossiers de cette base et les 261 entrées communales restent inchangés dans cette livraison. Le dossier supplémentaire par rapport aux 158 de la précédente intervention provient d'une collecte intermédiaire.

## Lecture rapide

Le conteneur du panneau devient sticky : auparavant, son enfant sticky était contraint par un parent aussi court que lui. L'aperçu suit désormais le défilement de la liste sur ordinateur et possède son propre défilement interne. Sur écran étroit, un aperçu flottant apparaît dans la zone visible, sans remonter la liste. Un second clic sur le marché sélectionné, le bouton Désélectionner ou Échap vide l'aperçu. Aucun marché n'est choisi automatiquement, y compris après un filtre ou un rechargement. La fiche complète reste une action explicite. Notes, favoris et décisions ne sont pas modifiés.

## Sources et communes

La page de couverture présente les dates belges avec heure et minute, distingue une lecture du site d'une exécution des collecteurs et expose dernier succès, tentative et erreur BOSA. Les anciennes métadonnées ne permettent pas de reconstituer les tentatives échouées non enregistrées ; cette limite est affichée.

Les compteurs communaux sont recalculés depuis les enregistrements, sans reprendre les anciens agrégats périmés. À la base : 261 entrées, 180 sites avec date de contrôle, 138 communes avec au moins une page repérée accessible, 20 avec documents lus et 106 documents au cumul. Ces lectures concernent alors des communes liégeoises ; les autres provinces ne sont pas déclarées couvertes. Des pages politiques et liens PDF ne prouvent pas une veille exhaustive.

L'utilisateur peut filtrer par province, commune, état ou zone, ouvrir les sources et préparer une relance avec le code INS. Le lancement manuel reste sur GitHub Actions : province et commune sont saisis dans Run workflow, branche main. Les liens ne déclenchent pas eux-mêmes une collecte et aucun jeton n'est fourni au navigateur. Une authentification et un service de collecte seront nécessaires pour un déclenchement intégralement sur Marché Radar.

## Collecteurs

- BOSA enregistre les échecs, conserve le dernier succès, les pages et la période du dernier parcours valide, et signale l'échec au workflow. Un succès suivant efface l'erreur. La publication des métadonnées d'échec n'est plus bloquée dans le workflow de premier import. La fenêtre habituelle reste de 14 jours, avec plafond de pages ; elle ne prouve ni l'exhaustivité nationale ni l'absence de faux négatifs du filtre métier.
- Les deux collecteurs communaux acceptent une province et un code INS. Un périmètre invalide est refusé. Le découpage réduit la taille de chaque passage ; les communes les moins récemment contrôlées sont prioritaires.
- La découverte inclut les liens de marchés publics et d'appels d'offres en plus des conseils communaux. Les nouvelles pages sont vérifiées par petits lots de six ; les candidates encore non lues sont gardées pour les passes suivantes.
- La lecture documentaire accepte les PDF directement repérés et explore au plus deux sous-pages de chaque source, sur le même domaine et sous le même chemin. Au plus trois sources et douze téléchargements PDF sont traités par commune et passage. La rotation des sources et des documents les moins récemment contrôlés limite les lectures répétées. Les PDF protégés, scannés ou accessibles uniquement par un script ne sont pas résolus par cette modification.
- Le passage communal programmé passe d'un par jour à six, toutes les quatre heures à minute 43 UTC. Chaque lot traite au plus douze sites et quatre communes pour les PDF. Cela accélère la rotation sans prétendre qu'une province entière est analysée à chaque lancement. La disponibilité des sites et la durée des tâches restent déterminantes.

## Validation

77 tests unitaires et quatre scripts de contrôle des collecteurs réussis localement. Tests ajoutés : périmètre provincial et INS, conservation des autres communes et dossiers, PDF directs et sous-pages, erreur puis succès BOSA, dates belges et compteurs calculés sur les faits. Les tests Chromium couvrent également une liste de 40 marchés avec sélection du 25e, visibilité sans remontée, désélection par clic/bouton/clavier, mobile, filtres provinciaux, date BOSA, erreurs de chargement et préparation de relance. Les tests existants sont adaptés à la sélection désormais explicite, sans supprimer les vérifications du suivi et des fiches.

Le binaire Chromium est absent du conteneur local : les parcours de navigateur sont exécutés dans GitHub Actions avant fusion. Les données réelles ne sont ni remplacées par les jeux de test ni recollectées pendant les tests.

## Suite

La surveillance exhaustive reste à construire et vérifier source par source. Priorités : valider les pages et PDF actuels des provinces encore peu lues, suivre la durée réelle d'une rotation, compléter les formats et sites non textuels, confronter les résultats à des marchés attendus connus, puis ajouter un service authentifié pour les lancements dans le site. Aucune certitude commerciale ou capacité KDRIX n'est déduite d'un statut vert.
