# Migration depuis Capacitor (historique)

> **STATUS: RETIRED**
> Capacitor is no longer part of the production architecture.
> Expo / React Native is the only Ball Manager mobile application.

Source : `ball-manager-web`, branche `claude/ios-app` (historique), dossier `mobile/` (Vite + React embarqué dans Capacitor, qui importe `src/` du web par alias). Le code Capacitor est **supprimé** de `ball-manager-web` (branche `claude/mobile-support`) ; il reste consultable dans l'historique Git de `claude/ios-app`.

## Capacitor current state

Bundle Vite local, projet Xcode `mobile/ios`, plugins officiels `app` et `push-notifications`, plugin natif local `BMNative`. Réutilise les composants UI du web (shims `next/link`, `next/image`, `next/navigation`). Tests : 3 fichiers (`auth-service`, `session-store`, `universal-link-router`). **Jamais compilé ni lancé sur iPhone** (environnement sans Xcode).

## Authentication protocol

Session d'appareil `bmd_…` dérivée du lien personnel ; SSO Safari (PKCE S256 + `state`) ; lien de connexion à usage unique. Identique côté Expo (`docs/AUTH.md`).

## Mobile API endpoints

`GET /v1/public/clubs`, `GET /v1/public/clubs/{slug}`, `POST …/auth/device-sessions`, `POST …/auth/token`, `GET|DELETE …/auth/session`, `POST|DELETE …/auth/session/people`, `PUT|DELETE …/auth/session/push-token`, plus les routes publiques d'équipe (action-center, planning, matchs, entraînements, convocations, maillots, tables, dérogations). Contrat : OpenAPI de `ball-manager-back`.

## Session lifecycle

180 jours glissants ; revalidation au lancement ; 401 `SESSION_INVALID` → club retiré ; réinitialisation du lien par un admin → perte d'accès ; « lien perdu ? » même adresse → session conservée.

## Secure storage

Capacitor : plugin natif `BMNative` (Keychain). Expo : `expo-secure-store`, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, un seul enregistrement JSON validé par Zod.

## Universal Links

Même AASA (web), mêmes chemins ; routeur `universal-link-router.ts` → `src/linking/` (même table de chemins, mêmes tests portés).

## Push registration

Capacitor : `push-notifications` (jeton APNs via `AppDelegate`), environnement fixé **au build** par `BM_APNS_ENV` (bug : jeton `development` déclaré `production`). Expo : jeton natif `getDevicePushTokenAsync`, environnement lu à l'exécution depuis le profil de signature.

## APNs environment

Voir `docs/PUSH.md`. Règle : jamais déduit de `__DEV__`/`NODE_ENV` ; TestFlight/App Store = production.

## Notification routing

`path` relatif du payload → `UniversalLinkRouter.handle` (Capacitor) / `resolveDestination` (Expo) ; un seul résolveur partagé avec les Universal Links.

## Existing screens

Bienvenue/choix du club, connexion (lien, code, SSO), accueil « À faire », planning, match + convocation, entraînements, équipe, dérogations, tables, compte. Réutilisaient les composants web (HTML/Tailwind).

## Existing tests

`auth-service.test`, `session-store.test`, `universal-link-router.test` (≈ 9+ tests de routage). Back : `device-auth` (18), `push` (15), `links`.

## Reusable logic

Protocole d'auth et de session, table de chemins, règles de destination après connexion, modèle de notification (`kind`/`path`), logique PKCE, règles de rôles.

## Code that must NOT be copied

Shims Next (`next-link`, `next-image`, `next-navigation`), `styles.css`/Tailwind web, composants HTML (`div`, `button`), plugin `BMNative`, configuration Xcode/Capacitor, `BM_APNS_ENV` figé au build, repli `localStorage`.

## Expo migration mapping

| Capacitor | Expo |
|---|---|
| `auth/session-store.ts` + `BMNative` | `src/auth/session-model.ts`, `session-repository.ts`, `secure-storage.ts` |
| `auth/auth-service.ts`, `callback.ts` | `src/auth/auth-service.ts`, `callback.ts`, `pkce.ts` |
| `auth/SessionContext.tsx` | `src/auth/SessionProvider.tsx` + `session-machine.ts` |
| `links/universal-link-router.ts`, `pending.ts` | `src/linking/*`, `src/app/+native-intent.tsx` |
| `push/push.ts` | `src/push/*` |
| `screens/ClubScreens.tsx` | `src/app/(app)/**` + `src/features/**` |
| `screens/AccountScreen.tsx` | `src/app/(app)/(tabs)/profil.tsx` |
| `shell/NetworkState.tsx`, `Splash.tsx` | bandeaux `Banner`/`ErrorState`, `expo-splash-screen` |
