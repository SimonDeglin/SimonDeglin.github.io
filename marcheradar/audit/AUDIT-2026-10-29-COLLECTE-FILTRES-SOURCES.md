# Collecte communale et filtres source / publication — 29 octobre 2026

Base : `065ccd7ed25cf77c73db565b8ddb5e87af9e6cb3`. Changements limités à Marché Radar et ses workflows. Les 161 dossiers initiaux sont conservés intégralement, sans modification de leurs champs ou des décisions du navigateur.

## Deux niveaux de filtres

Source : toutes, BOSA, TED, Site web communal. Une entrée Autres sites publics conserve notamment les publications provinciales sans les faire passer pour communales. Le second niveau est indépendant : tous, appels d'offres, attributions, prospection, autres.

Le croisement utilise les avis connus du même dossier. Un dossier TED de mise en concurrence peut aussi avoir un avis d'attribution BOSA : il est alors trouvé par TED/appels d'offres et BOSA/attributions, une seule fois dans chaque liste. Le type d'un avis principal n'est pas attribué à un lien secondaire non documenté. Les compteurs par source portent sur les dossiers avant choix du type ; ceux par type portent sur la source choisie. Un dossier pouvant contenir plusieurs avis, la somme des catégories peut dépasser le nombre de dossiers uniques. L'interface l'indique.

Les badges, l'aperçu et les messages de remise suivent la sélection. Une attribution sélectionnée n'est pas présentée comme un appel d'offres à préparer. Les dossiers, domaines, exclusions et notes restent conservés.

## Contrôle réel et correction Hannut

Six pages d'accueil ont répondu lors d'un contrôle HTTP : Amay, Hannut, Huy, Jodoigne, Namur et Waremme. Les redirections observées sont enregistrées séparément du site fourni par l'annuaire. Un passage documentaire ciblé a ensuite été effectué sur Amay, Hannut, Namur et Waremme, avec des petits lots, sans prétendre couvrir entièrement ces communes.

Le défaut Hannut a été reproduit sur la page du conseil communal : les fichiers passent par des routes WordPress `/download/...` sans extension `.pdf`. Le lecteur n'en retenait aucun. Il reconnaît désormais les liens de procès-verbaux, ordres du jour ou pièces de marché fournis par ce mécanisme, puis valide le contenu PDF reçu. Le paramètre de cache `tmstv` est retiré de l'identité ; les autres paramètres sont conservés. Une nouvelle valeur de cache ne doit pas recréer une opportunité ou perdre un classement.

36 liens documentaires ont été repérés à Hannut et 18 PDF distincts y ont été lus. Deux PDF ont été lus à Amay. Le cumul passe donc de 106 à 126 documents et de 20 à 22 communes avec documents lus. Des PDF ont été relus pour valider l'extraction ; ces relectures ne sont pas comptées comme de nouveaux documents distincts.

Namur a été rejoint par la redirection effectivement observée vers son site actuel. Ses pages de conseil et marchés publics ont été repérées ; des pages restent à explorer et une source a échoué. Waremme conserve également une source en erreur. Les échecs et le travail restant sont enregistrés : ni Namur ni Waremme ne sont déclarées entièrement lues.

## Qualité des sources et signaux

- Les conseils d'enfants/jeunes, conseils consultatifs et demandes d'interpellation ne font plus partie du parcours documentaire métier. Les entrées historiques restent visibles avec leur statut hors parcours.
- La découverte reconnaît aussi collèges communaux, plans d'investissement, programmes stratégiques et budgets communaux. Un sitemap borné peut être consulté si la page d'accueil ne fournit aucun lien utile.
- Les pages et téléchargements restent dans les files persistantes. À priorité identique, l'ordre initial de la source est conservé, plutôt que le tri alphabétique qui faisait passer d'anciens numéros de PDF avant les premiers liens publiés par le site. Cela ne permet pas d'inventer une date de publication.
- Une version d'extracteur est conservée. Une évolution de l'analyse peut relire un fichier inchangé ; elle ne devient pas une modification du PDF ni une nouvelle version de contenu.
- Les nominations d'agents constatateurs et actes de personnel ne suffisent plus à créer une piste de voirie.
- Les passages d'un même document partageant une référence explicite, le titre exact d'un marché ou le même point de séance sont regroupés. Des références distinctes restent séparées. Les autres extraits demeurent accessibles avec leurs pages.
- Le type communal repose sur une mention explicite. Un ordre du jour annonçant une décision d'attribution reste une prospection ; il ne prouve pas que la décision a été prise. Une attribution explicitement mentionnée dans un document peut être classée en attribution, avec extrait et empreinte. Une approbation de CSC ne devient pas une procédure ouverte confirmée.

Le pilote a produit cinq pistes documentaires de Hannut, qui portent notamment sur une étude de rénovation de voirie et des missions globales à examiner. Le total est de 166 dossiers. Ce ne sont pas cinq appels d'offres ouverts validés. Deux documents peuvent encore décrire des étapes d'un même projet sans référence de rapprochement commune : il n'y a pas de fusion floue entre documents ni de garantie d'absence de doublon commercial.

## Validation et limites

98 tests unitaires et quatre contrôles des collecteurs passent localement. Tests supplémentaires : sources croisées avec des types différents, non-duplication des dossiers, distinction province/commune, lien WordPress sans extension et cache variable, sitemap, exclusion des instances non pertinentes, ordre de traitement, type d'un ordre du jour, regroupement par référence/point de séance et rejet des nominations.

La CI Chromium contrôle les deux niveaux de filtres, les compteurs, les avis BOSA/TED du même dossier, les publications communales, les autres sources, l'aperçu d'attribution et le mobile, puis les parcours existants de suivi, sauvegarde et documentation. Les données du pilote sont réelles ; les jeux artificiels de tests ne sont pas publiés.

L'extraction porte sur des PDF textuels accessibles. Les pages HTML sont explorées comme sources de liens ; leurs décisions ne sont pas encore analysées comme des documents structurés autonomes. Les sites protégés, scannés, à rendu JavaScript ou les formats non PDF peuvent rester incomplets. Un passage réussi, un lien répertorié ou un compteur de pages ne prouvent pas l'exhaustivité de la collecte. Les visites, obligations et capacités KDRIX restent à vérifier dans les pièces officielles.
