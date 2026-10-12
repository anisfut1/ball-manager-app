# Notifications push

APNs **direct** depuis `ball-manager-back` (voir `docs/IOS_PUSH.md` du web / `src/modules/push` du back). Ni OneSignal, ni Firebase, ni Expo Push Service.

## Côté app

- **Permission** : jamais au lancement. Après connexion, carte « Recevez vos convocations et changements de match. » (accueil, puis Profil → Notifications) ; la demande iOS n'apparaît qu'au toucher du bouton.
- **Jeton** : `Notifications.getDevicePushTokenAsync()` (jeton natif APNs, pas `getExpoPushTokenAsync`), envoyé à `PUT /auth/session/push-token` pour **chaque** club connecté.
- **Environnement** : `Application.getIosPushNotificationServiceEnvironmentAsync()` — lu dans le profil de signature, jamais déduit de `__DEV__`/`NODE_ENV` (bug du Capacitor : jeton sandbox déclaré production). Simulateur / inconnu → aucun enregistrement. Build Xcode Debug = `development`, TestFlight et App Store = `production`.
- **Renouvellement** : `addPushTokenListener` → mise à jour serveur, sans boucle (clé `environnement:jeton` déjà envoyée ignorée).
- **Routage** : le champ `path` du payload passe par le **même résolveur** que les Universal Links ; démarrage à froid via `getLastNotificationResponseAsync`.
- **Premier plan** : bannière iOS + données rafraîchies en silence ; ni toast, ni navigation automatique.
- **Déconnexion** : jeton détaché avant la révocation de la session.

## Entitlement

`expo-notifications` avec `mode: development` (variante development) ou `production` (preview, production) dans `app.config.ts`.

## État de validation

IMPLEMENTED + UNIT TESTED (chemin de notification, environnement APNs, clé d'enregistrement). **NOT TESTED ON DEVICE**, aucun envoi APNs réel, aucun TestFlight.
