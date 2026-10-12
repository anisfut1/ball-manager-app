# Architecture de l'application mobile

```
ball-manager-back (Hono / Vercel) ── OpenAPI ──┬── ball-manager-web (Next.js)
                                                └── ball-manager-app (Expo / React Native)
                       Supabase (une base, une logique de permissions)
```

L'app est un client pur : la sécurité réelle est dans l'API. La navigation cliente n'est jamais une permission.

## Pile

Expo SDK 57, React Native 0.86, React 19.2, TypeScript strict, Expo Router (`src/app/`), TanStack Query, `openapi-fetch` sur types générés, Zod (état persisté), `expo-secure-store`, `expo-notifications`, `expo-web-browser`, Reanimated.

## Arborescence

| Dossier | Rôle |
|---|---|
| `src/app/` | routes Expo Router (uniquement des écrans) |
| `src/design/` | tokens, typographie, espacements, rayons, ombres, mouvement, accent du club |
| `src/components/ui/` | composants du design system (AppText, Button, Card, Screen, Badge, Avatar, EmptyState/ErrorState, Skeleton, Sheet, SegmentedControl, ListRow, ActionCard, SectionHeader…) |
| `src/api/` | client, erreurs humaines (401/403/404/409/422/429/5xx), clés de requête, endpoints, `generated/` |
| `src/auth/` | modèle de session pur, machine d'états, services, SessionProvider, stockage sécurisé, PKCE |
| `src/linking/` | normalisation, domaines, chemins historiques, destination en attente |
| `src/push/` | permission, jeton natif, environnement APNs, routage des notifications |
| `src/features/*` | modèles purs testés + hooks par fonctionnalité |
| `src/lib/` | dates au fuseau du club, rôles fusionnés |

## Navigation

Onglets : **Accueil · Planning · Équipes · Profil**. Écrans de club sous `/c/[clubSlug]/…` (match, convocation, entraînement, équipe, tables, dérogations). Routes d'authentification hors garde : `bienvenue`, `connexion/[clubSlug]`, `lien`, `code`, `session-expiree`, `web`.

## Rôles et multi-club

Les rôles de toutes les personnes de l'appareil sont fusionnés (`src/lib/roles.ts`) : pas de « mode parent/coach ». Plusieurs clubs : une session d'appareil par club, club actif mémorisé ; un lien vers un autre club bascule automatiquement si l'appareil y est connecté, sinon écran « Accès réservé » avec conservation de la destination (`c/[clubSlug]/_layout.tsx`).

## Données

TanStack Query : cache, rafraîchissement au retour au premier plan, mutations. Les réponses simples (entraînement, disponibilité, convocation) sont **optimistes avec retour en arrière** et message clair en cas d'erreur serveur. Pas d'offline métier en V1, mais jamais d'écran blanc (données en cache + bandeau).

## Dates

Toutes les heures sont formatées au **fuseau du club** (`src/lib/dates.ts`), jamais au fuseau du téléphone.

## Sécurité

Aucun secret dans le bundle. Secrets de session dans le Keychain (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). Aucun SDK de suivi, ni IDFA, ni ATT.
