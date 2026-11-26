# Cacahuète de Noël — famille Criscenzo (2026)

Neuf participants, 30 € maximum, exclusions entre conjoints et entre Olivia et ses parents dans les deux sens. Giovanni offre à Simon. Thomas et Mimi peuvent jouer pour Olivia.

## Déploiement et lancement

1. Relier cette branche au projet Netlify `cacahuete-noel-criscenzo`, avec le dossier de base vide et `public` comme dossier de publication. Le projet utilise Netlify Functions et Netlify Database. Les migrations sont dans `netlify/database/migrations/`.
2. Sans variable `GAME_MODE`, la page principale indique que le tirage est fermé. Ouvrir `/?essai=1` pour vérifier le tirage et la synchronisation des listes. L’essai et les données définitives ont des tables indépendantes. `/?demo=1` ouvre la démonstration locale.
3. Après les vérifications, définir `GAME_MODE=live` pour les fonctions en production et redéployer. L’appel de statut ne crée aucune attribution. Le premier accès à un profil initialise la partie définitive sur le serveur, en une transaction et sous verrou PostgreSQL.
4. Partager l’adresse principale à la famille. Chacun choisit son prénom et la roulette révèle son attribution définitive. Les consultations suivantes retrouvent le même résultat et la dernière liste. L’accès par prénom repose sur la confiance entre les participants.

`npm test` vérifie 10 000 attributions simulées. Ne pas réinitialiser les tables de production après le lancement.
