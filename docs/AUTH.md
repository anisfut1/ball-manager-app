# Authentification mobile

Protocole **existant** de `ball-manager-back` (`docs/MOBILE_AUTH.md` du back). L'app n'en crée aucun autre.

## Identité et session

Le licencié du lien personnel reste l'identité. L'app reçoit une **session d'appareil** (`bmd_…`, 180 jours glissants) par club, envoyée en `Authorization: Bearer` avec `X-BM-As: <licencieId>`. Le lien personnel n'est **jamais conservé** sur le téléphone ; la navigation ne dépend plus de `?token=`.

## Entrées (une seule sortie : session dans le Keychain)

1. **Lien personnel** (Universal Link, `?token=`/`#token=`, ou collé) → `POST /auth/device-sessions`.
2. **Lien de connexion à usage unique** (`/public/{slug}/connexion/code/{code}`) → `POST /auth/token`.
3. **« Continuer avec Ball Manager »** : `ASWebAuthenticationSession` (`openAuthSessionAsync`) → page web déjà identifiée → code de 5 min à usage unique lié au PKCE S256 + `state` → rappel `ballmanager://…` → `POST /auth/token` avec `codeVerifier`.

PKCE : S256 seul, `state` vérifié, code à usage unique, expiration côté serveur. Annulation par l'utilisateur ≠ erreur.

## Machine d'états

`BOOTING → UNAUTHENTICATED | AUTHENTICATED → REFRESHING → EXPIRED`. Le splash est maintenu pendant `BOOTING` (pas de flash login → accueil → login). Au lancement : Keychain → restauration → ouverture immédiate (hors ligne compris) → revalidation en arrière-plan. Un 401 `SESSION_INVALID` retire le club concerné.

## Déconnexion

Dans l'ordre : jeton push détaché → session révoquée → Keychain nettoyé → cache React Query vidé (club concerné, tout si dernier club) → destination en attente effacée → retour à la connexion.

## Après connexion

Destination d'origine mémorisée → authentification → vérification d'accès → écran exact (jamais l'accueil systématique). Voir `src/navigation/after-login.ts`.

## Comptes et suppression

L'app ne crée aucun compte (accès via un lien émis par le club) : la règle Apple de suppression de compte in-app ne s'applique pas ; « Se déconnecter » révoque la session et le jeton push. Pas de Sign in with Apple ni de login social (SSO Ball Manager + lien).
