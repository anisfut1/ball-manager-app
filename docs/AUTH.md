# Authentification mobile

Protocole **existant** de `ball-manager-back` (`docs/MOBILE_AUTH.md` du back). L'app n'en crée aucun autre.

## Comptes utilisateurs (entrée principale)

Chaque personne a **son propre compte** (email + mot de passe), géré par le back (`docs/ACCOUNTS.md` du back). Un compte peut suivre plusieurs licenciés, et un licencié peut être suivi par plusieurs comptes (parents, enfant).

- Inscription : `POST /v1/account/sign-up` → code à 6 chiffres reçu par email → `/sign-up/verify` (renvoyer : `/sign-up/resend`). Connexion : `/v1/account/sign-in`. Mot de passe oublié : lien Supabase.
- Rattachement : on cherche son nom (comme avant), puis `POST /account/links`. Actif tout de suite si une preuve existe (adresse vérifiée connue sur la fiche, ancienne session, invitation), sinon **en attente** de validation par un admin du club.
- Session : `ClubSession.account = { refreshToken, expiresAt, email }` ; le secret est le JWT d'accès, envoyé en `Authorization: Bearer` + `X-BM-As`. Le middleware `refreshAuthorization` (`src/api/credentials.ts`) le rafraîchit avant expiration (marge 60 s, un seul rafraîchissement à la fois).
- Passage à un compte : les sessions `bmd_…` de l'appareil sont importées comme preuves (`/account/links/device-session`), puis révoquées.
- Profil → *Mon compte* : email, personnes suivies, **Inviter un proche** (lien `/invitation#code`, 7 jours, usage unique), **Ne plus suivre**.
- Suppression : `DELETE /v1/public/clubs/{slug}/account` supprime le compte (la fiche sportive reste au club).

Les entrées ci-dessous (session d'appareil) restent acceptées pendant la transition.

## Identité et session (ancien modèle)

Le licencié du lien personnel reste l'identité. L'app reçoit une **session d'appareil** (`bmd_…`, 180 jours glissants) par club, envoyée en `Authorization: Bearer` avec `X-BM-As: <licencieId>`. Le lien personnel n'est **jamais conservé** sur le téléphone ; la navigation ne dépend plus de `?token=`.

## Entrées (une seule sortie : session dans le Keychain)

1. **Lien personnel** (Universal Link, `?token=`/`#token=`, ou collé) → `POST /auth/device-sessions`.
2. **Lien de connexion à usage unique** (`/public/{slug}/connexion/code/{code}`) → `POST /auth/token`.
3. ~~**« Continuer avec Ball Manager »**~~ (retiré de l'écran de connexion, remplacé par le compte) : `ASWebAuthenticationSession` (`openAuthSessionAsync`) → page web déjà identifiée → code de 5 min à usage unique lié au PKCE S256 + `state` → rappel `ballmanager://…` → `POST /auth/token` avec `codeVerifier`.

PKCE : S256 seul, `state` vérifié, code à usage unique, expiration côté serveur. Annulation par l'utilisateur ≠ erreur.

## Machine d'états

`BOOTING → UNAUTHENTICATED | AUTHENTICATED → REFRESHING → EXPIRED`. Le splash est maintenu pendant `BOOTING` (pas de flash login → accueil → login). Au lancement : Keychain → restauration → ouverture immédiate (hors ligne compris) → revalidation en arrière-plan. Un 401 `SESSION_INVALID` retire le club concerné.

## Déconnexion

Dans l'ordre : jeton push détaché → session révoquée → Keychain nettoyé → cache React Query vidé (club concerné, tout si dernier club) → destination en attente effacée → retour à la connexion.

## Connexion par lien pendant la feuille d'authentification

Un utilisateur non identifié dans Safari ne peut se connecter, dans la feuille ouverte par « Continuer avec Ball Manager », que par un lien reçu par e-mail. Ce lien s'ouvre hors de la feuille, dans l'app (Universal Link), et crée la session par `/lien` (`bootstrapFromToken`) ou `/code` (`loginWithCode`).

Quand l'une de ces deux connexions **aboutit** alors que la feuille est ouverte, l'app la ferme **une seule fois** (`WebBrowser.dismissAuthSession`, injecté dans `AuthDeps`). `ssoLogin` se résout alors en `{ kind: "superseded" }`, distinct de l'annulation : l'écran de connexion ne navigue pas et n'affiche rien (la navigation reste celle de `/lien` ou `/code`). Une connexion par lien qui **échoue** laisse la feuille ouverte ; une annulation par l'utilisateur garde son comportement (`SsoCancelled`, silencieux). Sans feuille ouverte, rien ne change.

## Après connexion

Destination d'origine mémorisée → authentification → vérification d'accès → écran exact (jamais l'accueil systématique). Voir `src/navigation/after-login.ts`.

## Suppression du compte (guideline Apple 5.1.1(v))

Profil → *Compte* → **Supprimer mon compte** → confirmation → **Supprimer définitivement**. `DELETE /v1/public/clubs/{clubSlug}/auth/me` (session `bmd_…`) est appelée **une fois par club de l'appareil, séquentiellement**, avec le secret de chaque club (`deleteAccount` dans `src/auth/auth-service.ts`, orchestré par `SessionProvider.deleteAccount`). Une seule séquence à la fois (un double appui ne la relance pas).

- `204` ou `401` : nettoyage **local** du club, sans aucun appel serveur (la session est déjà révoquée) : Keychain, cache React Query, destination en attente (si dernier club), état push local.
- Réseau ou `5xx` : le club reste intact. L'utilisateur reste dans l'app, le message nomme les clubs concernés ; un nouvel essai ne vise que les clubs restants.
- Tous supprimés : retour à l'accueil non connecté, message « Ton compte a été supprimé. » (`src/auth/account-deleted-notice.ts`).
- Le `401` de cette route ne passe **pas** par le flux global « session invalide » (`call(null, …)`) : pas de double navigation ni d'écran « session expirée ».

La fiche sportive reste au club. Ne jamais supprimer le licencié du compte de revue Apple pendant les tests. Pas de Sign in with Apple ni de login social : email + mot de passe uniquement (guideline 4.8 non concernée).
