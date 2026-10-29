# Dates des documents communaux

La liste, la lecture rapide et la fiche affichent la date de séance ou du document sans ouverture du PDF. Une invitation peut afficher les deux dates (Hannut : document du 15 avril, séance du 23 avril 2026). La date de publication et le dernier contrôle de collecte restent distincts. Le tri « Plus récents » utilise la date documentaire pour les sources locales ; les dates absentes arrivent en dernier. Les documents de plus de 365 jours portent une indication explicite, sans exclusion automatique supplémentaire.

L’extraction se limite aux mentions explicites de l’en-tête ou à l’annonce du prochain conseil. Les dates de lois et séances précédentes citées dans le corps ne sont pas retenues. La preuve conserve URL, extrait, page et empreinte du fichier. Une date issue du titre ou du nom de fichier est marquée « à confirmer ». Si aucune date fiable n’existe, « Date du document non identifiée » est affiché. Le contrôle HTTP et la date de découverte ne datent jamais le document.

Relecture réelle des documents associés au listing : neuf PDF téléchargés et analysés ; le PDF provincial de Liège a répondu HTTP 500, sa date de nom de fichier reste une déduction. Sur 40 dossiers de source locale (y compris anciens dossiers écartés), 14 ont une date explicite lue dans le PDF, quatre une date déduite du nom de fichier, 22 restent sans date. Les cinq pistes Hannut sont datées de séances des 23 avril, 21 mai et 25 juin 2026. Aucun identifiant, classement, extrait métier, échéance, publication TED/BOSA ni nombre de dossiers n’est modifié. Total : 168.

Les futures lectures communales enregistrent les dates avec la version PDF ; une preuve liée à une autre URL ou empreinte n’est pas affichée comme actuelle. Le changement de version d’extracteur permet la reprise des fichiers déjà lus sans faux changement de contenu.

Validation : 104 tests unitaires, quatre contrôles de collecteurs ; parcours Chromium étendu au listing, au tri, à la lecture rapide, à la fiche et aux dates inconnues. L’extraction ne prétend pas dater tous les documents : PDF scannés, en-têtes inhabituels et pages HTML sans date restent à traiter ultérieurement.
