# Qualification KDRIX et file documentaire communale — 29 octobre 2026

Base : `2fda315935ba1c809308f600d16dae8018607db9`. Les 161 dossiers et tous leurs identifiants sont conservés. Aucun autre module du portail n'est modifié.

## Qualification métier et décisions

La qualification distingue services, travaux, contrats mixtes et signaux de prospection. Le score reste un indice de repérage : aucune admissibilité, disponibilité, référence ou capacité KDRIX n'est présumée. L'explication précise si le dossier paraît correspondre à une prestation métier, une mission globale ou une prestation accessoire.

Un auteur de projet pour une église ou une école ne devient plus une mission VRD prioritaire sur cette seule expression. En l'absence d'objet de voirie ou hydraulique identifié, le domaine VRD est retiré ; les autres indices sont conservés et la mission reste à vérifier. Une catégorie « Mission à qualifier » dans Autres évite d'inventer un métier. Une prestation topographique intégrée à des travaux reste à examiner comme possible lot ou sous-traitance. Les petits travaux hydrométriques conservent leurs règles spécifiques.

Les correspondances lexicales respectent les limites de mots, avec radicaux techniques explicites et pluriels. « Falemprise » ne devient plus « emprise », « déménagement » ne devient plus « aménagement » et les implantations scolaires ou commerciales ne suffisent plus à qualifier de l'implantation topographique. Une étude de schéma de développement communal reste à vérifier dans Mission à qualifier.

Sur la base de cette intervention : 24 dossiers prioritaires, 68 à vérifier, 69 écartés par le filtre, contre 48, 49 et 64 auparavant. Parmi les anciens prioritaires, 24 sont déclassés vers la vérification. Les cinq exclusions supplémentaires restent consultables et réversibles. Les autres modifications enrichissent ou précisent la qualification. Les champs hors classement (titres, sources, dates, inventaires, analyses, historique documentaire, etc.) sont comparés à la base et conservés.

Le navigateur respecte les domaines transmis par les collecteurs : il ne réajoute plus des métiers au titre seul lorsqu'une classification existe. L'aperçu explique le motif de qualification et les limites du score. Les exclusions automatiques ont une vue distincte, accessible même lorsque des métiers sont masqués ; elles ne sont plus mélangées aux dossiers non classés. L'historique les conserve.

Une réintégration crée une décision explicite « inbox » dans le stockage existant. Les classements manuels, y compris les décisions antérieures sur un marché écarté par l'algorithme, restent prioritaires. Le registre public n'enregistre pas ces décisions privées. Hors sujet, notes et favoris restent réversibles et sous les mêmes clés de stockage.

## File documentaire communale

La limite d'une passe n'est plus une troncature aux douze premiers PDF ou deux premières sous-pages. Les candidats sont enregistrés dans une file persistante par commune. Au plus trois pages et douze PDF sont traités par passage ; les éléments encore jamais tentés passent avant les relectures. Les autres liens restent disponibles pour les passages suivants. Les sources disparues ne suppriment pas les PDF déjà suivis.

Les pages restent sur le même domaine et sous le chemin de la source. Le parcours s'arrête à trois niveaux de profondeur. Les registres sont bornés à 600 pages et 4 000 PDF par commune ; toute limite atteinte est signalée, sans prétendre à une couverture exhaustive. Une erreur conserve la dernière version exploitable et reporte la prochaine tentative de six heures. Les empreintes, extraits historiques et identifiants des dossiers existants sont préservés.

La page des communes expose le nombre de pages et PDF restant à traiter ainsi qu'une éventuelle limite d'exploration. Les anciens registres n'ont pas encore ces compteurs : ils sont explicitement indiqués comme non mesurés jusqu'au prochain passage du collecteur. La liste des communes n'est pas présentée comme une couverture déjà réalisée.

## Validation et limites

87 tests unitaires réussis localement, plus les quatre contrôles des collecteurs. Régressions supplémentaires : architecture et travaux, services métier, petits travaux hydrométriques, erreurs lexicales, étude urbanistique conservée, idempotence et préservation des champs hors qualification, trente PDF parcourus en trois lots, sous-pages au-delà de la deuxième, limites et reprise après erreur.

La CI exécute les parcours Chromium existants et un parcours de qualification/exclusion : catégories sans ajout parasite, motif, réintégration puis rechargement, conservation d'une décision À répondre, note et favori, accès aux 161 dossiers historiques. Les tests des anciens parcours sont adaptés à la séparation des exclusions automatiques sans enlever les vérifications de préservation. Aucune donnée de test n'est publiée dans la base réelle.

Le binaire Chromium n'étant pas présent dans le conteneur local, les parcours de navigateur sont exécutés dans GitHub Actions avant fusion.

Ce lot ne généralise pas encore la lecture des CSC : les analyses existantes restent conservées. Il ne mesure pas le rappel face à un corpus indépendant d'avis officiels. Il reste notamment à étendre la lecture des formats, vérifier les obligations et quantités avec sources, construire le référentiel de moyens KDRIX et l'espace partagé authentifié. Les tests de qualification démontrent le traitement des cas contrôlés, pas l'absence de faux négatifs dans toute la commande publique.
