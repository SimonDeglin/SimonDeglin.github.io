# Marché Radar — feuille de route produit KDRIX (27 octobre 2026)

## Vision

Marché Radar doit identifier les opportunités publiques utiles à KDRIX, en vérifier la pertinence et les conditions réelles, puis aider le bureau à décider, préparer et suivre les offres. Ce n'est pas un simple agrégateur d'avis.

Les **dossiers de suivi restent le premier niveau de navigation**, les domaines le deuxième, et les filtres d'échéance et de publication ne changent jamais silencieusement de dossier.

## Tranches de livraison

| N° | Amélioration validée | Priorité | Livraison prévue | Critère de réussite |
|---|---|---|---|---|
| 01 | Accueil opérationnel | P0 | V4-A | Nouveaux dossiers, dates critiques, inconnues et avis de résultat visibles immédiatement |
| 02 | Listing compact | P0 | V4-A | Lire l'objet, acheteur, domaine, type d'avis et échéance sans fiche détaillée |
| 03 | Fiche « décider en 30 s » | P0 | V4-A/B | Aperçu métier, dates, preuves, limites et accès CSC identifiables sans jargon |
| 04 | Navigation trois zones | P1 | V4-A/B | Dossiers à gauche, marchés au milieu, aperçu contextuel à droite sur grand écran |
| 05 | Filtres secondaires simples | P1 | V4-A | Type de publication, domaine, région, échéance ; compteurs identiques aux résultats |
| 06 | Concours / résultats / prospection distincts | P0 | V4-A | Aucune piste locale ni attribution présentée comme procédure officiellement ouverte |
| 07 | Dates et heures fiables | P0 | V4-C | Dernière échéance officielle, fuseau, provenance, correction par rectificatif |
| 08 | Pertinence métier robuste | P0 | V4-C | Faux positifs réduits sur échantillon audité, motif du score explicite |
| 09 | Veille communale vérifiable | P1 | V4-C | Sources communales réellement surveillées, documents datés, statut d'accès visible |
| 10 | Regrouper avis, lots et rectificatifs | P1 | V4-C | Une procédure = un dossier, toutes les versions et échéances en historique |
| 11 | Lire PDF / Word / Excel | P0 | V4-D | CSC, annexes, bordereaux et rectificatifs accessibles analysés selon leur format |
| 12 | Synthèse géomètre / ingénieur | P0 | V4-D | Prestations exactes et contraintes explicitées par domaine KDRIX |
| 13 | Quantités / livrables | P0 | V4-D | Surfaces, longueurs, profils, systèmes de coordonnées, livrables avec page source |
| 14 | Obligations bloquantes | P0 | V4-D | Visites, références, agréments et pièces de candidature avec preuve explicite |
| 15 | Traçabilité de chaque fait | P1 | V4-D | Document, version, page et rectificatif associés à chaque information vérifiée |
| 16 | Questions / réponses sur le dossier | P2 | V4-E | Réponses uniquement étayées par sources, « information inconnue » si insuffisante |
| 17 | Décision répondre / ne pas répondre | P0 | V4-E | Profil matériel/références KDRIX, risques, charge, métier et critères bloquants |
| 18 | Espace de préparation des offres | P1 | V4-E | Checklist, responsable, documents, visite, chiffrage, dépôt confirmé |
| 19 | Alertes ciblées | P1 | V4-E | Nouveaux avis, rectificatifs, visites et échéances, sans bruit inutile |
| 20 | Intelligence commerciale | P2 | V4-F | Attribution, adjudicataire, montants, renouvellements, concurrents et performance KDRIX |

## Chantiers techniques transversaux

- Sécuriser les données internes hors du dépôt public avant toute collaboration.
- Conserver les identifiants de marché, dossiers, notes et favoris déjà enregistrés.
- Consolider le JavaScript historique qui contient des définitions redondantes, par lots testés.
- Contrôler continuellement les sources TED, BOSA et communes : date, erreurs, retards, couverture et taux de doublons.
- Tester chaque version dans Chromium avec des marchés réels ET des scénarios déterministes.
- Fusionner seulement une version avec tests réussis ; conserver le retour arrière.
- Ne jamais déclarer une date, une visite ou un CSC « vérifié » sur simple inférence de mots-clés.

## V4-A — premier chantier publié

- Remplacer le grand bandeau décoratif par un tableau de bord à 4 indicateurs opérationnels.
- Séparer les **appels d'offres**, les **avis de résultat**, la **prospection locale** et les publications encore à qualifier.
- Garder « Listing complet » = marchés non classés, indépendamment du filtrage.
- Préserver les domaines comme filtres du dossier actif ; les compteurs doivent correspondre au même périmètre.
- Compacter les lignes et afficher un aperçu métier contextuel sur grand écran.
- Corriger le dossier initial (pas « Tous les marchés » déguisé en « Listing complet »).
- Préserver la fiche complète des Phases 1–3B en parallèle.
- Tester le déplacement d'un marché, le changement de domaine et de type, le retour à Listing complet et le mode dégradé.

**Avancement :** V4-A publiée le 27 octobre 2026. La version initiale ouvrait encore le grand panneau au clic sur le marché ; ce retour utilisateur est traité dans V4-B.

## V4-B — lecture rapide réellement dynamique et dossier Hors sujet

- Clic sur une ligne ou sur son titre : **sélectionne le marché et actualise la lecture rapide** sans ouvrir le grand tiroir.
- Bouton **Fiche complète** : seul déclencheur explicite du tiroir détaillé, depuis la ligne ou l'aperçu.
- Aperçu enrichi par l'objet réel, l'acheteur, les domaines, les pièces disponibles, les courts extraits PDF courants et les notes enregistrées.
- Ligne sélectionnée visuellement distinguée ; navigation au clavier prise en charge.
- Dossier **Hors sujet** distinct de **Sans suite** : un marché sans intérêt métier est masqué des dossiers de travail, favoris, urgences et historique général ; il reste visible dans son dossier spécifique.
- Actions simples **Écarter : Hors sujet / Réintégrer**, et classement également possible depuis la fiche complète et le menu déroulant.
- Conservation du classement après rechargement du site ou nouvelle collecte, tant que l'identifiant du marché reste stable.
- Réinitialisation des filtres masquants lors de l'ouverture de Hors sujet.
- Tests Chromium des transitions, du mobile, du stockage et des Phases 1–3B.

**Limite actuelle importante :** les classements, notes et exclusions sont enregistrés dans le stockage local du navigateur (`kdrix.marcheRadar.v1`). Ce n'est pas une suppression des avis officiels du fichier public ni un classement synchronisé entre ordinateurs. Un espace sécurisé partagé est un chantier transversal ultérieur.

**Étapes suivantes :** V4-C (pertinence, vrais marchés ouverts, dates officielles, provenance des sources et regroupement des rectificatifs), puis V4-D (CSC et analyse métier), V4-E (décision et préparation d'offres), V4-F (statistiques et veille concurrentielle).

## V4-C — dates BOSA (premier lot vérifié)

Audit public du 28 octobre 2026 : 5 avis de mise en concurrence BOSA confirmés avec accord exact entre la rubrique « Date limite de soumission » du portail, la valeur `vault.submissionDeadline` de l'API officielle, et le fuseau CET/CEST de Bruxelles.

- La date du dossier Wodecq était prolongée : l'état actif est retenu plutôt que l'ancienne version.
- L'importeur n'enrichit que les **avis de mise en concurrence**, jamais les avis d'attribution.
- Une date absente, contradictoire ou non explicitement affichée ne peut pas être inventée.
- Les dates préexistantes contradictoires d'origine indéterminée restent inchangées pour vérification humaine.
- La source BOSA et son URL figurent dans les fiches ; l'application ne garantit pas l'absence de futurs rectificatifs.
- Lors de collectes futures, seule une nouvelle preuve peut modifier une date vérifiée ; l'ancienne valeur est alors conservée dans l'historique.

La qualité métier, les doublons et la veille communale restent les autres priorités du chantier V4-C.
