# Collecte communale récente — 29 octobre 2026

## Règle commerciale

Les pistes communales du listing actif doivent dater des trois derniers mois civils : au 29 octobre, à partir du 29 juillet 2026 inclus. Une date de collecte ne rajeunit pas un document. Sans date identifiable, une piste ne rejoint pas le listing actif. Les archives restent consultables dans l’historique ; les dossiers explicitement classés par l’utilisateur sont préservés. Cette fenêtre porte sur la veille communale, pas sur les appels d’offres BOSA/TED ni sur leurs échéances officielles.

## Causes corrigées

- Des listes de PDF commençaient par 2015–2024 ; les petits lots lisaient ces archives avant les fichiers récents. La file trie les dates identifiables et les années récentes en priorité. Les anciens liens restent tracés sans absorber les lectures actives.
- Les formulaires d’envoi, vidéos, pages de composition, règlements et déclarations générales occupaient le parcours. Ils sont exclus. Téléchargements et redirections sont limités aux domaines communaux et à Délibérations.be ; une redirection vers un domaine tiers est refusée avant connexion.
- Délibérations.be affichait ses décisions par une requête publique séparée. Le collecteur lit désormais les séances récentes, les cartes dont le lien est vide et le titre voisin, puis les décisions métier et leur pagination. Les identifiants de séance de longueur variable, notamment observés à Namur, sont acceptés.
- Une décision récente citant un plan déjà dressé, une ancienne attribution, un avenant, un règlement ou un marché de travaux n’est plus une nouvelle mission d’études à prospecter. Les contrôles distinguent l’annonce d’une mission et une simple mention dans les considérants.
- Les scans étaient illisibles avec pdftotext seul. Un OCR borné est ajouté : six premières pages par défaut, huit au maximum ; les lectures partielles et l’OCR sont signalés. Huit scans récents ont été testés réellement, à Clavier, Huy, Engis et Fexhe-le-Haut-Clocher. L’ordre du jour d’Engis, où « auteur de projet » est coupé sur deux lignes, a produit une piste retenue, marquée OCR à vérifier.

## Passage réel et résultats retenus

52 communes ont fait l’objet du contrôle élargi, réparties sur les cinq provinces. Cela ne signifie pas qu’elles sont entièrement couvertes. Les échecs et les files restantes sont conservés. Le cumul enregistré atteint 203 PDF et 151 documents HTML, dans 60 communes avec lecture documentaire. Les compteurs de PDF, de HTML, d’erreurs et de pistes récentes restent distincts.

Cinq nouveaux dossiers de prospection sont retenus, avec texte officiel et date de séance :

| Commune | Séance | Signal |
| --- | --- | --- |
| Engis | 27/10/2026 | Désignation d’un auteur de projet pour le schéma de développement communal — OCR à vérifier |
| Ittre | 20/10/2026 | Désignation d’un auteur de projet pour le Plan communal de mobilité |
| Oupeye | 12/10/2026 | Mission d’auteur de projet pour une aile de l’école Jules Brouwir — mission globale à qualifier |
| Theux | 08/09/2026 | Désignation d’un auteur de projet pour dossiers multiples |
| Quévy | 02/09/2026 | Élaboration d’un schéma de développement communal — décision de principe |

La décision du 15 octobre d’Amay relative au marché de géomètre 2026.1625 est rattachée au dossier BOSA existant sur référence explicite et acheteur identique, sans créer une ligne en double. Le filtre « Site web communal » dispose ainsi de six dossiers récents. Les cinq anciennes pistes Hannut ne sont plus actives à cette date. Il n’est pas prétendu que six procédures ouvertes soient disponibles : les projets de décision et signaux de prospection demandent validation.

Le total passe de 168 à 173 dossiers. Les 168 identifiants initiaux et leurs champs sont conservés ; seul le dossier d’Amay est enrichi par la décision communale. Les notes et décisions du navigateur restent attachées aux mêmes identifiants.

## Rotation et limites

Le workflow existant reste programmé six fois par jour. Chaque passage sélectionne jusqu’à douze communes, en traite trois en parallèle avec fichiers isolés, puis fusionne par identifiant. Le parcours est borné et reprend les files. Un filtre par province et commune reste disponible. La disponibilité et la complétude des sites ne sont pas garanties ; scans difficiles, téléchargements bloqués, pages non explorées et erreurs conservées empêchent de déclarer une couverture exhaustive.

116 tests unitaires et quatre contrôles de collecteurs passent. Les tests couvrent la frontière de trois mois, les fins de mois, la conservation de l’historique, la priorité aux documents récents, les cartes HTML, les identifiants variables, la pagination, les fausses pistes déjà confiées, les redirections externes et la fusion sans perte. Les parcours Chromium de filtres, suivi, sauvegarde, dates et mobile sont exécutés avant publication.
