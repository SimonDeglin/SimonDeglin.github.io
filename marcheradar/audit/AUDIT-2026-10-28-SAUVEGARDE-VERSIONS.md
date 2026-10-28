# Sauvegarde du suivi et versions des documents communaux — 28 octobre 2026

Suite de l'audit de fiabilité. Base : `52427ebb8c7c360c50cbdef6a8395b511d343309` (158 dossiers après les collectes automatiques). Cette livraison ne modifie ni `data.json` ni `communes.json`.

## Corrections

- Réglages : export JSON des classements, notes, favoris et secteurs masqués ; import avec aperçu, validation stricte et choix explicite des conflits. Le choix initial conserve les valeurs présentes. Les identifiants absents de la collecte restent sauvegardés.
- Une réintégration en boîte de réception conserve désormais une décision explicite, exportable. Une note vide ou un favori désactivé restent aussi des valeurs explicites.
- L'import conserve un instantané téléchargeable du suivi précédent. Une erreur de stockage empêche l'application en mémoire. Un changement intervenu dans un autre onglet bloque l'import jusqu'au rechargement.
- Les PDF communaux déjà rencontrés sont contrôlés de nouveau : empreinte SHA-256, validateurs HTTP, dates et historique des empreintes. Un téléchargement complet est imposé après sept jours lors du prochain passage du collecteur, même si le serveur fournit des validateurs.
- Les dossiers liés gardent leurs identifiants et extraits historiques. Un extrait non retrouvé est signalé. Les nouveaux passages d'un document déjà lié apparaissent dans la fiche comme passages à comparer, sans attribution automatique à un dossier ni recréation de celui-ci.
- Les erreurs de téléchargement ou de lecture conservent le dernier contenu exploitable et sont inscrites dans le suivi de collecte. Les écritures se font par remplacement atomique de chaque fichier, données avant registre des documents.

## Validation

65 tests unitaires et quatre scripts de contrôle des collecteurs passent localement. Les tests couvrent migration, conflits, erreurs de stockage, suivi absent du flux, changement de PDF à URL constante, réponse 304, erreur 503, fichiers invalides, limites de taille, préservation des identifiants et échappement HTML.

Le workflow de validation exécute également Chromium : cockpit existant, sauvegarde/restauration, annulation, conflit, réintégration, rechargement, quota indisponible et affichage des versions documentaires, puis les parcours documentaires existants. La fusion est conditionnée à leur réussite.

## Limites et suite

- La sauvegarde est manuelle et locale, sans synchronisation entre appareils. Le fichier contient les notes : il doit rester privé. Aucun contenu de sauvegarde n'est envoyé au serveur.
- Un fichier modifié ne prouve pas un rectificatif officiel. Les nouveaux passages d'un document déjà lié nécessitent une comparaison humaine ; ce choix évite de créer à tort une nouvelle opportunité et de faire réapparaître un dossier écarté.
- Seuls les PDF textuels accessibles sont analysés ici, sans OCR. L'historique conserve les empreintes et les extraits, pas les fichiers PDF complets. La fréquence réelle de revisite dépend du parcours progressif des communes et de leur disponibilité.
- Les deux fichiers du collecteur ne forment pas une transaction commune. L'ordre des écritures permet de rejouer sans duplications si la seconde écriture échoue.
- Restent notamment : analyse approfondie et sourcée des CSC et annexes, exigences/références obligatoires, qualification selon les moyens réels de KDRIX, couverture documentaire plus large, préparation des offres et alertes. Le temps routier reste estimatif.
