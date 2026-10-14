# MarchéRadar KDRIX — Couverture et mise en service

Dernier état vérifié : 14 octobre 2026.

## Sources réellement connectées

| Source | Situation | Contrôle |
| --- | --- | --- |
| TED — avis européens | Connecté, collecte via API officielle et GitHub Actions | Vérifier \`data.json > sources\` et \`generated_at\`. La couverture dépend de la période et des champs disponibles. |
| TED — attributions | Module d'extraction implémenté | Les soumissionnaires, attributaires, prix et nombres d'offres ne sont renseignés **que si présents dans un avis correspondant**. L'extraction ne garantit pas la couverture des résultats. |
| BOSA e-Procurement — publications belges | **Non connecté / pas encore validé** | Un collecteur expérimental existe, mais son succès avec le portail public n'est pas confirmé. |
| Publications provinciales | Pilote expérimental (pages et PDF Liège/Namur) | Ne couvre pas encore les communes. La découverte, le texte, la date et la pertinence doivent être contrôlés. |
| Délibérations des communes | **Non connecté** | Développement nécessaire : catalogue de communes, pages de publications, PDF/HTML et historique. |

Une donnée BOSA ajoutée manuellement n'est pas la preuve d'une collecte nationale automatique.

## Pourquoi BOSA bloque le remplacement de Tender Experts

Les publications e-Procurement sont consultables publiquement sur https://www.publicprocurement.be.
Cela **ne constitue pas la preuve** qu'un endpoint de recherche non authentifié autorise une collecte complète en volume.

La recherche expérimentale dans \`tools/bosa-public.cjs\` :
- ne contourne pas les authentifications ;
- échoue fermement si le serveur renvoie un refus ou une structure inattendue ;
- ne remplace pas les données TED précédemment valides ;
- **ne marque pas BOSA comme connecté** sans réponse validée.

**Prochaine démarche :** demander au support e-Procurement du SPF BOSA une documentation technique officielle et la procédure d'accès autorisé pour consulter/réutiliser le Bulletin belge (API, export, accès partenaire, éventuels identifiants OAuth/clé). Ne pas placer d'identifiants ou de documents internes dans ce dépôt GitHub Pages public. En cas d'accès partenaire, enregistrer les secrets dans les secrets GitHub Actions, après vérification du protocole officiel.

Marché de contrôle : \`03.06.04-26-2843\` — stations limnimétriques SPW, trois lots. Le connecteur ne sera considéré comme opérationnel que s'il récupère l'avis **automatiquement**, sans fiche précréée.

## Qualité et exclusivité du suivi

- Les marchés peuvent avoir plusieurs étiquettes métiers, mais un seul état de suivi.
- Les modifications et rectificatifs doivent garder l'identifiant déjà utilisé dans le navigateur.
- Dans le site statique actuel, les statuts et commentaires restent dans le **localStorage du navigateur** ; ils ne sont pas partagés entre collègues.
- Écarter les achats de matériel, assurances, curage, travaux de voirie comme entrepreneur, marchés flamands.
- Conserver les prestations topographiques, PEB, divisions, bornages, jaugeages, auteurs de projet VRD, relevés réseaux, bathymétrie, petits travaux techniques admissibles.
- Les résultats seulement mentionnés indirectement doivent être marqués « À vérifier ».
- Les prix d'offres, les prix attribués et les estimations sont des notions distinctes. Les données non publiées restent « Non publié ».
- Les flux peuvent être incomplets : ne jamais annoncer une exhaustivité non mesurée.

## État automatisé et alertes

Les collectes TED sont planifiées trois fois par jour dans \`.github/workflows/marcheradar.yml\`.
Le workflow :
1. teste les collecteurs et la classification ;
2. collecte TED ;
3. tente l'accès BOSA séparément, sans conclure « source connectée » en cas de refus ;
4. teste des sources provinciales pilotes ;
5. conserve le fichier valide si une erreur survient.

La CI est configurée pour conserver les détails d'erreur dans les journaux plutôt que générer des e-mails de workflow en échec.
Une mise à jour ancienne doit être visible dans MarchéRadar.

## Conditions pour déclarer les jalons terminés

1. **BOSA** : au moins plusieurs avis nationaux recueillis automatiquement, y compris le dossier SPW de contrôle, dates et références exactes, aucune donnée manuelle comptée comme succès.
2. **Attributions** : avis de résultats TED/BOSA authentiques reliés à leur procédure (et lot quand vérifiable), vainqueurs et valeurs uniquement sourcés.
3. **Sources locales** : pages officielles réellement lues pour plusieurs communes wallonnes, preuves datées et lien au passage pertinent. Pas de faux « projet » créé sur un ancien PV.
4. **Qualité** : test d'anti-doublon intersources, historique conservé, indicateurs datés par source, comparaison avec échantillon Tender Experts.

Ce document est un état technique, **pas** une garantie de couverture.
