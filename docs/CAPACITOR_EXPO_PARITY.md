# Parité Capacitor / Expo (historique)

> **STATUS: RETIRED**
> Capacitor is no longer part of the production architecture.
> Expo / React Native is the only Ball Manager mobile application.

Statut final : **CAPACITOR = RETIRED** · **EXPO = ACTIVE MOBILE ARCHITECTURE**. L'app Capacitor (`ball-manager-web/mobile/`) a été supprimée ; ce tableau reste comme trace de la parité atteinte.

Légende validation : IMPL = implémenté · UNIT = testé unitairement · DEVICE = testé sur iPhone. **Aucune ligne n'est DEVICE.**

| Feature | Capacitor | Expo | Backend | Tested | Remaining |
|---|---|---|---|---|---|
| Choix du club / bienvenue | oui (web UI) | natif | `GET /v1/public/clubs` | IMPL | device |
| Session d'appareil (Keychain) | `BMNative` | `expo-secure-store` | device-auth | UNIT | device |
| SSO Safari + PKCE | oui | `openAuthSessionAsync` | `/auth/codes`, `/auth/token` | UNIT (PKCE RFC, callback) | device |
| Lien personnel / collé | oui | oui | `/auth/device-sessions` | UNIT | device |
| Lien de connexion à usage unique | oui | oui | `/auth/token` | UNIT | device |
| Universal Links + chemins historiques | oui | `+native-intent` | AASA (web) | UNIT (11 tests) | AASA prod, device |
| Multi-club + AccessDenied | partiel | oui | — | UNIT (4) | device |
| Plusieurs enfants | oui | oui | session/people | UNIT | device |
| Push APNs (jeton, enregistrement) | oui | natif, env. réel | push-token | UNIT | device, TestFlight |
| Routage des notifications | oui | même résolveur | payload `path` | UNIT | device |
| Accueil / Action Center | web UI | natif, optimiste | team-life | UNIT | device |
| Planning | web UI | natif timeline | planning | UNIT | device |
| Match + disponibilités | web UI | natif | team-life | IMPL | device |
| Convocation participant / coach | web UI | natif | convocations | UNIT (builder) | device |
| Entraînements (séries, occurrences) | web UI | natif | trainings | UNIT | device |
| Équipes | web UI | natif | teams | IMPL | device |
| Maillots | web UI | natif | laundry | IMPL | device |
| Tables de marque | web UI | natif | table-assignments | IMPL | device |
| Dérogations | web UI | natif | derogation-requests | IMPL | device |
| Profil / version / déconnexion | oui | natif | session | IMPL | device |
| Hors ligne / réseau | bandeau | bandeaux + cache | — | UNIT (erreurs) | device |
| Build | **jamais compilé** | **aucun build EAS exécuté** | — | — | Development Build |
| Suppression Capacitor | — | — | — | — | **RETIRED** : `mobile/` supprimé de `ball-manager-web` (branche `claude/mobile-support`) |
