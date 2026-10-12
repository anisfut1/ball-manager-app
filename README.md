# Ball Manager — application mobile

Application native **Expo / React Native** (iOS d'abord, Android ensuite) de Ball Manager.
C'est un client du backend `ball-manager-back` : aucun second backend, aucun second système d'authentification ou de notifications.

| Dépôt | Rôle |
|---|---|
| `anisfut1/ball-manager-web` | SaaS web Next.js (Vercel), pages publiques, AASA, confidentialité/support |
| `anisfut1/ball-manager-back` | API Hono (Vercel), Supabase, FFBB/FBI, OpenAPI, APNs, authentification mobile |
| `anisfut1/ball-manager-app` | **ce dépôt** |

Documentation : [architecture](docs/MOBILE_ARCHITECTURE.md) · [auth](docs/AUTH.md) · [liens universels](docs/UNIVERSAL_LINKS.md) · [push](docs/PUSH.md) · [parité](docs/MOBILE_PARITY_MATRIX.md) · [tests iPhone](docs/IOS_TEST_MATRIX.md) · [App Store](docs/APP_STORE.md) · [migration Capacitor](docs/MIGRATION_FROM_CAPACITOR.md) · [parité Capacitor/Expo](docs/CAPACITOR_EXPO_PARITY.md) · [manuel](MANUAL_STEPS.md)

## Prérequis

- Node ≥ 20.19, npm.
- Un Mac avec Xcode récent **ou** un compte EAS (builds dans le cloud).
- Expo SDK 57 (React Native 0.86, React 19.2, Expo Router 57).

## Installation

```sh
npm ci
```

Ajouter une dépendance : `npx expo install <paquet>` (jamais `npm add`, jamais `--force`).

## Variables d'environnement (publiques uniquement)

Tout bundle mobile est public : **aucun secret** (service role Supabase, clé APNs, Resend, CRON_SECRET, identifiants FBI…).

| Variable | Rôle |
|---|---|
| `EXPO_PUBLIC_API_URL` | URL de `ball-manager-back` |
| `EXPO_PUBLIC_WEB_URL` | URL de `ball-manager-web` (défaut `https://www.ball-manager.fr`) |
| `APP_VARIANT` | `development` / `preview` / `production` (fixé par les profils EAS) |
| `BM_ASSOCIATED_DOMAINS` | domaines Universal Links (défaut `www.ball-manager.fr`) |
| `EXPO_OWNER`, `EAS_PROJECT_ID` | compte et projet EAS |

Copier ces valeurs dans un `.env.local` (ignoré par git) pour le développement.

## Génération du client API

```sh
BM_OPENAPI_SOURCE=<url ou fichier openapi.json> npm run api:generate
```

Écrit `src/api/generated/schema.ts` depuis l'OpenAPI de `ball-manager-back` (source de vérité). Aucun DTO n'est recopié à la main : `src/api/types.ts` ne fait qu'indexer le schéma généré.

## Développement

```sh
npm run lint && npm run typecheck && npm test
npx expo-doctor
npm start        # serveur Metro pour un Development Build
```

**Expo Go ne suffit pas** (APNs, Associated Domains, SSO de production) : utiliser un Development Build.

## Development Build

```sh
npx eas-cli build --profile development --platform ios   # cloud
npm run ios                                              # local (Xcode)
```

## Universal Links

Domaines déclarés dans `app.config.ts` (`associatedDomains`), fichier AASA hébergé par `ball-manager-web`. Voir [docs/UNIVERSAL_LINKS.md](docs/UNIVERSAL_LINKS.md).

## Auth

Session d'appareil (`bmd_…`) dans le Keychain via `expo-secure-store`, PKCE + `state` pour le SSO Safari. Voir [docs/AUTH.md](docs/AUTH.md).

## Push

APNs direct, jeton natif (`getDevicePushTokenAsync`), environnement APNs lu à l'exécution. Voir [docs/PUSH.md](docs/PUSH.md).

## Tests

```sh
npm test
```

Tests purs (modèles, machine de session, PKCE, résolveur de liens, rôles, dates, erreurs). Rien ne remplace les tests sur appareil : [docs/IOS_TEST_MATRIX.md](docs/IOS_TEST_MATRIX.md).

## EAS Build / Submit

```sh
npx eas-cli build --profile preview --platform ios        # TestFlight interne / ad hoc
npx eas-cli build --profile production --platform ios     # App Store
npx eas-cli submit --profile production --platform ios
```

Les profils sont dans `eas.json`. Un changement natif exige une nouvelle build ; EAS Update n'est jamais un moyen de contourner la revue Apple.

## Dépannage

- *Universal Link ouvre Safari* : AASA absent/redirigé, ou lien tapé dans la barre d'adresse (Safari ne l'ouvre pas) ; voir docs/UNIVERSAL_LINKS.md.
- *Jeton push refusé* : environnement APNs ≠ build (build Xcode Debug = `development`, TestFlight/App Store = `production`).
- *`api:generate` échoue* : vérifier `BM_OPENAPI_SOURCE` ; le générateur tourne via `npx` avec son propre TypeScript 5.
- *Écran blanc au démarrage* : le splash reste tant que le Keychain n'est pas lu ; vérifier les journaux Metro.
