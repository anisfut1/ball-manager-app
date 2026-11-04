# Audit de sécurité de l'app — novembre 2026 (A0, lecture seule)

Périmètre : `ball-manager-app` (Expo SDK 57, iOS et Android). Audit statique du dépôt, sans build ni appareil. Ce qui n'a pas pu être vérifié est écrit comme tel.

## Synthèse

| Réf. | Sujet | Constat | Gravité | Suite |
| --- | --- | --- | --- | --- |
| A1 | Dépendances | `zod` 4.6.5 vulnérable (haute) ; `decode-uri-component` via `expo-router` (haute) ; le reste vient surtout d'outils de build et de test | Moyenne | `zod` corrigé dans le lot A1. Le reste exige un changement majeur du SDK Expo |
| A2 | Stockage des jetons | Keychain iOS en `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` ; `load()` masque les erreurs de lecture | Faible | Ne pas changer maintenant ; durcir `load()` d'abord (voir ci-dessous) |
| A3 | Android | `allowBackup` non fixé ; pas de minification R8 | Moyenne | `allowBackup: false` dans le lot A3 ; R8 demande un nouveau paquet à valider |
| A4 | Liens profonds | Bien verrouillés | Aucune | Rien à faire |
| A5 | CI | Aucune CI | Moyenne | À créer |
| A6 | Types et `/openapi.json` | Non audité | — | Dépend du back |
| A7 | Suppression de compte | Présente (`DELETE /auth/me`, tests) | Aucune | Rien à faire |

## A1 — Dépendances

`npm audit --omit=dev` : 41 avis (6 hauts, 30 modérés, 5 faibles, 0 critique).

- **`zod` 4.6.5 (haute, direct)** : épuisement mémoire sur des collections volumineuses (GHSA-mrhx-c7xc-m3w5). Corrigé en 4.6.7, sans changement de version majeure. L'app l'utilise pour valider les données de session, de club et d'administration (`session-model.ts`, `default-club.ts`, `admin-session.ts`) ; l'exposition réelle est donc limitée, mais l'avis reste « haute ».
- **`decode-uri-component` (haute)**, via `query-string` puis `expo-router`. Déni de service par un décodage d'URL mal formée. L'app reçoit des URL externes (liens universels), donc le chemin est atteignable. Le correctif npm passe par `expo-router` 58, c'est-à-dire un changement de SDK Expo : hors de ce chantier.
- **`node-forge` (haute)** et le reste (`@expo/cli`, `@expo/config-plugins`, `glob`, `minimatch`, `uuid`, jest) : outils de build et de test, absents du binaire livré. Les correctifs automatiques proposés (`expo@51`, `jest@25`) sont des régressions de version : à ne pas appliquer.

Décision proposée : corriger `zod` maintenant ; prévoir une montée du SDK Expo (planifiée, avec test sur appareil) pour fermer `decode-uri-component`.

## A2 — Stockage des jetons (iOS Keychain, Android Keystore)

- Les secrets passent tous par `expo-secure-store` (`src/auth/secure-storage.ts`). Aucun `AsyncStorage`, `localStorage` ni MMKV dans le code.
- Accessibilité actuelle : `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` (jamais sauvegardé ni restauré sur un autre appareil). La feuille de route propose `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.
- Les secrets ne sont lus que par `SessionProvider` (premier plan). Aucune tâche d'arrière-plan (`TaskManager`, `BackgroundFetch`) ; les notifications sont affichées par le système et ouvrent l'app au toucher. Le passage à `WHEN_UNLOCKED` semble donc compatible.
- **Constats vérifiés dans le code d'`expo-secure-store` 57 (iOS, `SecureStoreModule.swift`)** :
  1. La **lecture** ne filtre pas sur l'accessibilité (requête par service et clé seulement) : changer l'option ne rend **pas** les anciens secrets illisibles.
  2. L'**écriture** d'un secret déjà présent ne met à jour que sa valeur (`update`), jamais son accessibilité. Changer l'option ne protège donc que les **nouveaux** secrets ; les appareils existants gardent `AFTER_FIRST_UNLOCK` tant que le secret n'est pas supprimé puis réécrit (migration explicite, avec sauvegarde pour ne rien perdre si l'app s'arrête entre les deux).
  3. Sur Android l'option est ignorée (Keystore).
- **Lancement en arrière-plan appareil verrouillé : non activé.** Le mode `remote-notification` n'est pas déclaré (le plugin `expo-notifications` ne l'ajoute que si `enableBackgroundRemoteNotifications` est vrai) et le back envoie des notifications `alert` sans `content-available`. L'app ne tourne donc pas verrouillée, et `WHEN_UNLOCKED` ne devrait pas empêcher de lire. **Non testé sur appareil** (préchauffage iOS notamment).
- **Fragilité indépendante du choix de l'accessibilité** : `session-repository.ts › load()` attrape toute erreur de lecture et renvoie un état **vide**. Si une lecture échouait (appareil verrouillé, erreur Keychain), l'app resterait lancée avec un état vide ; ouvrir ensuite un lien personnel réécrirait le stockage et **écraserait** les sessions des autres clubs ou personnes. À durcir (distinguer « rien de stocké » d'« erreur de lecture » et ne pas écraser dans ce cas) avant toute évolution du Keychain.
- **Recommandation** : ne pas changer l'accessibilité pour l'instant. Gain faible (un attaquant doit déjà tenir l'appareil verrouillé après un premier déverrouillage), migration à écrire avec soin, et aucune validation possible sans appareil. À reprendre après avoir (a) durci `load()` et (b) validé le tout sur un build TestFlight.

## A3 — Android

- `android.allowBackup` n'est pas fixé dans `app.config.ts`. La valeur par défaut d'Expo autorise la sauvegarde automatique des données de l'app. À fixer à `false`.
- Minification R8 : nécessite `expo-build-properties` (nouveau paquet, non ajouté sans validation).
- Aucun `intentFilters` : pas de liens universels Android (seulement le schéma `ballmanager://`). C'est cohérent avec une app iOS en premier ; à confirmer si Android est visé.

## A4 — Liens profonds et Universal Links : conforme

- Domaines acceptés : `www.ball-manager.fr`, `ball-manager.fr`, `open.ball-manager.fr`, HTTPS uniquement (`src/linking/validateDomain.ts`). Tout autre domaine est rejeté.
- Slugs et identifiants validés par expressions régulières strictes ; chemins inconnus renvoyés vers l'accueil.
- Rappel SSO : correspondance exacte de l'URL de rappel, `state` obligatoire, code borné à `[A-Za-z0-9_-]{20,128}`.
- Écran « disponible sur le site » : l'URL externe n'est ouverte que si elle commence par `https://(www.)ball-manager.fr/`.
- Le jeton d'un lien personnel est échangé une fois contre une session d'appareil puis oublié (`docs/AUTH.md`).
- Aucun `console.*` dans le code de l'app : aucun jeton dans les journaux.

## A5 — CI

Aucun workflow GitHub, ni Dependabot. À créer sur le modèle du back : lint, typecheck, tests, audit de production, gitleaks, actions épinglées par SHA.

## A6 — Types générés et `/openapi.json`

`npm run api:generate` lit le schéma du back en production. À relier au sujet « `/openapi.json` reste public tant que l'app génère ses types depuis la prod » : passer par un back local avant de le cacher en production.

## A7 — Suppression de compte (App Store 5.1.1(v))

Présente : `DELETE /auth/me` côté back, service et tests côté app (`delete-account-service.test.ts`). Rien à faire.

## Non vérifié

- Comportement réel du Keychain et de la sauvegarde Android (pas d'appareil, pas de build).
- Contenu des journaux natifs et des rapports de plantage.
- Configuration du compte Apple, d'EAS et des secrets de build.
