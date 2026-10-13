# Notifications push

APNs **direct** depuis `ball-manager-back` (voir `docs/IOS_PUSH.md` du web / `src/modules/push` du back). Ni OneSignal, ni Firebase, ni Expo Push Service.

## Côté app

- **Permission** : jamais au lancement. Après connexion, carte « Recevez vos convocations et changements de match. » (accueil, puis Profil → Notifications) ; la demande iOS n'apparaît qu'au toucher du bouton.
- **Jeton** : `Notifications.getDevicePushTokenAsync()` (jeton natif APNs, pas `getExpoPushTokenAsync`), envoyé à `PUT /auth/session/push-token` pour **chaque** club connecté.
- **Environnement** : `Application.getIosPushNotificationServiceEnvironmentAsync()` — lu dans le profil de signature, jamais déduit de `__DEV__`/`NODE_ENV` (un jeton sandbox déclaré production ne recevrait rien). Simulateur / inconnu → aucun enregistrement. Build Xcode Debug = `development`, TestFlight et App Store = `production`.
- **Renouvellement** : `addPushTokenListener` → mise à jour serveur, sans boucle (clé `environnement:jeton` déjà envoyée ignorée).
- **Routage** : le champ `path` du payload passe par le **même résolveur** que les Universal Links ; démarrage à froid via `getLastNotificationResponseAsync`.
- **Premier plan** : bannière iOS + données rafraîchies en silence ; ni toast, ni navigation automatique.
- **Déconnexion** : jeton détaché avant la révocation de la session.

## Entitlement

`expo-notifications` avec `mode: development` (variante development) ou `production` (preview, production) dans `app.config.ts`.

## État de validation

IMPLEMENTED + UNIT TESTED (chemin de notification, environnement APNs, clé d'enregistrement).

**Vérifié sur iPhone le 2026-10-13** : clé APNs (.p8 « Ball Manager Push », Sandbox & Production, Team Scoped) dans Vercel (`APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, projet club-manager-api, Production) ; build EAS interne (jeton `production`) ; « Envoyer une notification de test » (Profil → Notifications, `POST …/auth/session/push-test`, cet iPhone seulement) → reçue.

Pas encore observé : une notification déclenchée par un vrai événement (convocation, changement de match…) reçue par une famille, ni un build TestFlight.

Diagnostic du bouton de test : `not_configured` = variables APNs absentes du back ; `InvalidProviderToken` = Key ID et clé privée ne correspondent pas (ou Team ID faux) ; `BadDeviceToken` = jeton d'un autre environnement.
