# KDRIX Bathy — architecture cible et état de la phase 1

## Statut
Version de prévisualisation séparée de la production. Anciennes recherches conservées et accessibles.
Ce document n'atteste pas encore de tests navigateur ni de couverture réelle du territoire.

## Architecture fonctionnelle cible

- Moteur A : inventaire des plans d'eau (PICC et sources officielles ; traitement par sous-secteurs).
- Moteur B : inventaire des établissements potentiellement intéressés (sources légalement réutilisables).
- Associations : relations entre bassin et société, avec statut **confirmé / à vérifier / aucun lien**, preuve et date.
- Mes prospects : fiche commerciale unique, contacts professionnels, historique et statuts.
- Carte de couverture : découpage permanent, indépendant des villes, filtres et périodes.

## Grille de référence
Projection EPSG:3812 (ETRS89 / Belgian Lambert 2008), cellules carrées **5 000 × 5 000 m**, ancrées sur l'origine métrique du SCR ; identifiant `BE3812-5K-{ix}-{iy}` où les indices valent `floor(X / 5000)` et `floor(Y / 5000)`.

Le rayon de recherche est exprimé en kilomètres à vol d'oiseau. Les cellules intersectant le disque sont retenues **en entier** : la couverture de grille dépasse donc parfois légèrement le cercle de recherche. Ceci évite les zones partiellement reconnues comme complètes à la limite des rayons.

Chaque cellule contient deux états indépendants : `water` et `company`. Chaque état est composé de 4 sous-secteurs de 2 500 × 2 500 m, destinés à prévenir la troncature des requêtes. Un état est **terminé** si et seulement si les 4 sous-secteurs ont été contrôlés avec succès, avec une source et une date enregistrées.

Couleurs : gris = aucun moteur terminé ; bleu = seul `water` terminé ; orange = seul `company` terminé ; vert = deux moteurs terminés. Un contour pointillé rouge signale la présence de recherches partielles ou en erreur. Les mises à jour futures doivent calculer les statuts à partir des preuves techniques, jamais à partir d'une simple case.

Le bouton `OK, terminé` concerne seulement le contrôle **manuel** : `manual.done`, `manual.notes`, `manual.reviewedAt`. Il ne colore pas une cellule et ne certifie aucun résultat technique.

## Stockage

IndexedDB `kdrix_bathy_v2`, version 1, magasins :
- `cells` : cellules et états par sous-secteur, horodatage, remarques et validation humaine ;
- `bodies` : bassins identifiés et identifiants sources ;
- `companies` : établissements et activités identifiés ;
- `relations` : associations validées, rejetées ou à vérifier ;
- `prospects` : fiches et suivi commercial ;
- `meta` : version des moteurs, périmètres, historique et migrations.

Les cellules non prospectées sont calculées à la volée, sans écrire des milliers de lignes vierges. Les moteurs suivants renseigneront les états réels lorsqu'ils auront achevé leurs sous-requêtes.

## Reprise des versions précédentes

Les anciennes données de `kdrix_bathy_inventory_v1` (`waters`) et `kdrix_bathy_custom_prospects_v1` (localStorage) peuvent être **copiées** vers la nouvelle base sur demande explicite.
L'opération :
- ne supprime ni ne modifie l'original ;
- conserve les données brutes dans `original` ;
- ne reprend aucun statut de couverture ancienne comme `complete` : les preuves de réussite par sous-secteur ne sont pas garanties ;
- ne déduit pas automatiquement qu'une société possède ou exploite un bassin.

Les exports JSON versionnés permettent une sauvegarde hors navigateur et la reprise sur un autre ordinateur. Cela ne constitue **pas** une synchronisation centralisée.

## Phases restantes

1. **Phase 1 — en prévisualisation :** grille, couverture, contrôle manuel, stockage et import/export conservateur.
2. **Phase 2 :** moteur PICC avec sous-secteurs métriques, pagination/troncature, dédoublonnage, date/source par requête et rendu des emprises.
3. **Phase 3 :** moteur indépendant d'identification des sociétés via sources autorisées, contacts et activité, sans propriétaire présumé.
4. **Phase 4 :** rapprochements, confirmation/rejet et fiches prospects.
5. **Phase 5 :** tests intégrés sur navigateurs et réseaux, vérification sur le terrain puis remplacement des anciennes entrées.

## Sources officielles de la grille / eau
- https://epsg.io/3812
- https://geoservices.wallonie.be/arcgis/rest/services/TOPOGRAPHIE/PICC_VDIFF/MapServer/30

## Consigne de sécurité
Ne retirer les anciens écrans « Nouvelle recherche » et « Recherche étendue » qu'après validation des deux nouveaux moteurs, migration complète et contrôle de non-régression.
