# Marché Radar — Phase 3A : audit initial des sources (15 octobre 2026)

## Inventaire réel
- 64 marchés/opportunités dans `marcheradar/data.json`, répartis entre 16 BOSA, 14 TED et 34 pistes locales.
- 15 dates limites renseignées, 49 absentes.
- Aucune liste de pièces de consultation certifiée par le collecteur dans la base actuelle.
- Les fiches Phase 2 différencient déjà correctement avis officiel, documents effectivement répertoriés et informations non vérifiées.

## Contrôle reproductible sur 10 marchés
Script : `marcheradar/tools/phase3a-diagnostic.cjs`.  
Exécution : https://github.com/SimonDeglin/SimonDeglin.github.io/actions/runs/38753986518

Cinq publications BOSA ont répondu HTTP 200 ; cinq publications TED ont donné des réponses HTTP 202 (parfois accompagnées d'une source BOSA HTTP 200).
- **10** dossiers publics interrogés.
- **7** dossiers avec au moins une réponse HTTP 200.
- **0** lien direct de type PDF/Word/Excel/ZIP découvert dans le HTML statique accessible.
- **0** échéance corrigée automatiquement, car aucune date supplémentaire n'a été **vérifiée**.
- **0** fichier déclaré comme un CSC sans preuve documentaire.

Les détails par marché (HTTP, documents identifiés, échéance connue) sont disponibles dans les artefacts de l'exécution.

## Conclusion technique
L'accès simple au HTML public ne permet pas encore de récupérer les CSC. Les plateformes peuvent charger les pièces par des appels API internes ou une interface JavaScript ; certains espaces nécessitent une connexion. Une réponse 200 prouve seulement l'accessibilité d'une réponse, **pas** l'existence ou la lisibilité de ses annexes.

## Étape suivante nécessaire
1. Tester un navigateur avec exécution JavaScript sur ces dix dossiers ; relever les appels réseau **publics** réellement déclenchés par l'ouverture de la zone Documents.
2. Identifier les endpoints documentaires officiels réellement accessibles sans authentification ; ne contourner aucun refus.
3. Mettre en place un extracteur document/échéance spécifique à la source, avec tests de provenance et politique de validation.
4. Mettre à jour les fiches `data.json` **uniquement** pour les pièces et dates dont le lien, la source et l'accessibilité ont été prouvés.
5. Relancer les tests des Phases 1–2 et les tests de nouvelles données avant publication.

## Résultats complémentaires — inventaires réels BOSA

Les tests en navigateur ont observé les rubriques officielles « Documents » de cinq marchés BOSA et les réponses JSON publiques de leurs API documentaires.

L'enrichissement généralisé de la branche de développement a confirmé :
- 64 marchés conservés, sans changement d'identifiants.
- 15 dossiers BOSA avec récupération de métadonnées publiques.
- 25 pièces identifiées par nom, format, version et référence source, réparties entre 3 marchés.
- 3 URL de consultation documentaire externe publiées officiellement sur BOSA.
- 16 pièces répertoriées pour la bathymétrie des étangs de Bruxelles Environnement, dont un CSC français et des annexes.

Les noms de fichiers et les identifiants sont issus de l'API publique ; aucun fichier n'est déclaré téléchargé ni analysé.
Le code conserve les anciens inventaires si une réponse de source devient vide ou inaccessible.
La fiche indique « pièce répertoriée — accès à vérifier », distinctement des fichiers directement liés.

**Limite majeure :** aucune date limite nouvelle n'a encore été vérifiée ou mise à jour. La lecture effective du contenu des CSC et la vérification des téléchargements demeurent à réaliser.

**Validation :** tests unitaires documentaires et tests de non-régression Chromium Phases 1 et 2 exécutés dans GitHub Actions sur la branche de développement.

**Conclusion :** première tranche fonctionnelle de la Phase 3A, encore incomplète pour les échéances et le téléchargement direct.

## Fiabilisation pour la mise en production

- Le collecteur documentaire est intégré à la planification existante TED/BOSA, à la fin du traitement avant publication du JSON.
- Il conserve les inventaires précédents lorsque le portail échoue ou répond avec une liste vide.
- Les réponses inchangées n'actualisent plus artificiellement `documentsCheckedAt` et ne provoquent pas une nouvelle publication GitHub Pages.
- La tâche peut utiliser Chromium installé sur les runners GitHub avec `playwright-core`.
- Les collecteurs TED et BOSA préservent les champs documentaires lors des fusions ; un test automatique reproduit les deux opérations.
- Les workflows de diagnostic temporaires sont retirés afin de limiter les notifications GitHub. La validation finale conserve les tests des Phases 1, 2 et 3A.
