# Marché Radar V2 — Audit et validation de la phase 1

**Date :** 15 octobre 2026  
**Branche isolée :** `feature/marcheradar-v2-phase1-20261015`  
**Production :** branche `main`, laissée inchangée pendant le développement.

## 1. État relevé avant les modifications

- Application statique dans `marcheradar/index.html` : HTML, CSS et JavaScript intégrés.
- Jeu de données `marcheradar/data.json` : **64 fiches** au moment de l'audit.
- Provenance des fiches : **14 TED, 16 BOSA, 34 LOCALE**.
- **15 fiches** comportent une date limite, **49** ne comportent pas de date limite renseignée.
- Filtrage préalable enregistré : **18 principales, 12 à vérifier, 34 signalées comme écartées**. Ces catégories de préqualification ne sont pas des dossiers de suivi KDRIX.
- Les statuts, favoris, notes et préférences restent dans le stockage local du navigateur sous la clé `kdrix.marcheRadar.v1` ; il ne s'agit **pas** d'un stockage partagé ou sauvegardé sur serveur.
- Plusieurs collecteurs et workflows distincts alimentent les données ; **aucun n'a été modifié dans cette phase**.

## 2. Problèmes structurels identifiés

1. **Deux jeux de définitions JavaScript dans une seule page** : les fonctions `filtered`, `renderList`, `renderNav`, `renderStats`, `render`, `openTender`, `load` et d'autres sont déclarées deux fois. Les dernières définitions l'emportent ; cela rend les modifications ponctuelles dangereuses. Leur suppression/refactorisation nécessitera une intervention séparée et testée.
2. Le menu indiquait « Listing complet » pour l'historique global, et « À trier » pour le dossier non classé : vocabulaire contraire au fonctionnement demandé.
3. Cliquer sur un domaine repositionnait automatiquement le dossier sur l'historique global, donc une catégorie pouvait afficher des marchés classés ailleurs.
4. Les compteurs des domaines n'étaient pas calculés à partir de la même sélection que les lignes affichées.
5. Le classement de pertinence (`main`, `review`, `excluded`) pouvait masquer des marchés **sans** classement manuel, alors qu'ils existaient dans la base.
6. Les dates limites absentes ne permettent pas d'affirmer qu'un marché officiel est ouvert.

## 3. Modifications apportées en phase 1

- **Listing complet** redevient le dossier initial **non classé** (`inbox`).
- Les autres dossiers de suivi existants sont conservés (À définir, À répondre, En attente d'attribution, Obtenu, Perdu, Sans suite).
- **Historique général** conserve un accès distinct à toutes les fiches, sans être un dossier de suivi.
- Un changement de dossier remet le filtre par domaine à « Toutes les catégories ».
- Le clic sur une catégorie ne change plus le dossier.
- Les catégories, les listes et les compteurs s'appuient sur des critères cohérents : dossier, région, recherche et échéance.
- Nouveau filtre par échéance à l'intérieur du dossier : **toutes**, **ouvertes**, **clôturées**, **à vérifier**.
- Les dates civiles sont évaluées selon le jour à Bruxelles **sans inventer d'heure limite** ; les horodatages avec fuseau explicite sont comparés à l'heure réelle.
- Sans date limite : une opportunité `LOCALE` est considérée ouverte **à la prospection**, et les autres marchés restent à vérifier.
- Les préqualifications automatiques à vérifier / écartées sont désormais signalées plutôt que masquées silencieusement.
- Le stockage local existant n'est pas effacé et les identifiants des marchés ne sont pas modifiés.
- Aucun collecteur, donnée officielle ni module Bathymétrie/Terres n'est modifié.

## 4. Tests automatisés

Workflow : [Validation Phase 1](https://github.com/SimonDeglin/SimonDeglin.github.io/actions/runs/38733866668) — **succès**.

Le script `marcheradar/tests/phase1-browser.cjs` exécute Chromium via Playwright sur une copie locale de l'application :

1. Vérification de la syntaxe du script principal.
2. Vérification des **64 fiches existantes**, des compteurs et de leur affichage initial.
3. Déplacement d'un marché de Listing complet vers Sans suite.
4. Vérification de l'exclusivité du dossier, des filtres métiers et des compteurs.
5. Conservation des notes et du classement après rechargement.
6. Retour du marché vers Listing complet.
7. Scénarios d'échéance : future, passée, jour même, absente, locale sans limite, horodatages précis.
8. Recherche texte et cohérence des compteurs.
9. Absence d'erreur JavaScript non interceptée pendant les scénarios.

Ces tests ont **réellement été exécutés** et ont réussi. Ils ne remplacent pas une revue humaine dans le navigateur sur le site final.

## 5. Points en attente / prochaines étapes

- **Pas de publication sur `main` tant que la version de développement n'est pas approuvée.**
- La correspondance de pertinence pour les 34 fiches préqualifiées « exclues » devra être examinée : leur affichage dans le dossier non classé vise la transparence, pas une recommandation commerciale.
- Retirer proprement les fonctions JavaScript redondantes avec tests de non-régression séparés.
- Phase 2 : fiches détaillées, visites, conditions de participation et documents officiels **seulement lorsque les sources peuvent les justifier**.
- Préparer une solution de sauvegarde/synchronisation sécurisée avant toute utilisation multi-utilisateur.

## 6. Procédure de retour arrière

La version de référence reste sur `main`. Tant qu'aucune fusion n'est faite, il suffit de ne pas fusionner la branche de développement pour conserver le site inchangé. En cas de régression après une future publication, restaurer la version précédente de `marcheradar/index.html` à partir de l'historique Git, sans écraser `data.json` ni les autres modules.
