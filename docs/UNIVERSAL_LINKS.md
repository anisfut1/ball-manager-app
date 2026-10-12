# Universal Links et liens historiques

## Configuration

- Team ID `YFZ72KY47V`, Bundle ID `fr.ballmanager.app` (l'AASA servi par `ball-manager-web` déclare `YFZ72KY47V.fr.ballmanager.app`).
- `app.config.ts` : `associatedDomains` = `applinks:www.ball-manager.fr` par défaut. N'ajouter `ball-manager.fr` / `open.ball-manager.fr` (variable `BM_ASSOCIATED_DOMAINS`) **qu'après** avoir vérifié que l'AASA y répond 200, `application/json`, sans redirection.
- L'AASA reste hébergé par `ball-manager-web` (`/.well-known/apple-app-site-association`).

## Résolveur unique (`src/linking/`)

`normalizeIncomingUrl` (HTTPS + domaine de confiance, ou schéma `ballmanager://`) → `resolveLegacyPath` → `Destination` (`route | bootstrap | login-code | web-only | home | reject`). Utilisé par `+native-intent` (Universal Links), le lien collé et le **routage des notifications** : un seul système.

## Chemins pris en charge

| Chemin web | Écran de l'app |
|---|---|
| `/public/{club}`, `/accueil`, `/connexion` | accueil du club (`#seance-<id>` → entraînement) |
| `/public/{club}/matchs/{id}`, `/resultats/{id}` | match (`#convocation` → convocation, `#vie-equipe` → vue coach) |
| `/public/{club}/planning`, `/entrainements` | planning / entraînement / équipe |
| `/public/{club}/equipes[/{id}]`, `/derogations[/{id}]`, `/tables` | équipe(s), dérogation(s), tables |
| `/public/{club}/connexion/code/{code}` | échange du code |
| `/c/{club}/matchs|equipes|derogations|tables|planning` | équivalents natifs |
| `/c/{club}/admin/*`, `/platform/*`, `/login`… | **web uniquement**, assumé (`/web`) |
| domaine étranger, `http:` | rejeté |

Jeton personnel (`?token=` ou `#token=`) : échangé contre une session, jamais conservé dans la route. Routes techniques (`session`, `auth`, `manifest.webmanifest`) : jamais un écran. Anti-doublon de 3 s au démarrage à froid.

## Multi-club

Lien d'un autre club : membre → bascule automatique ; sinon « Accès réservé » et destination conservée jusqu'à la connexion.
