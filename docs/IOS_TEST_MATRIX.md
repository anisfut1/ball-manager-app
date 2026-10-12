# Matrice de tests iPhone (Expo)

Légende : ✅ automatisé (Jest) · ❌ **NOT TESTED ON DEVICE** (iPhone, build EAS/Xcode ou compte Apple nécessaires). Aucun test sur appareil, aucune build EAS, aucun envoi APNs réel ni TestFlight n'a été fait à ce jour.

## Automatisé (`npm test`)

| Domaine | Fichier | État |
|---|---|---|
| PKCE (vecteur RFC 7636), rappel SSO, `state` | `src/auth/auth.test.ts` | ✅ |
| Modèle de session, machine d'états, stockage sécurisé, services | `src/auth/auth.test.ts` | ✅ |
| Multi-club (bascule, retrait, personne active) | `src/auth/multi-club.test.ts` | ✅ |
| Résolveur de liens, chemins historiques, destination en attente | `src/linking/linking.test.ts` | ✅ |
| Destination après connexion | `src/navigation/after-login.test.ts` | ✅ |
| Chemin de notification, environnement APNs | `src/push/push.test.ts` | ✅ |
| Action Center, réponse optimiste | `src/features/home/action-center-model.test.ts` | ✅ |
| Builder de convocation, séries d'entraînement, planning | `src/features/**` | ✅ |
| Rôles fusionnés, dates au fuseau du club, erreurs API, accent | `src/lib`, `src/api`, `src/design` | ✅ |

## Sur iPhone (Development Build, puis TestFlight)

| Groupe | Scénario | État |
|---|---|---|
| AUTH | Installation neuve (aucune permission au lancement) | ❌ |
| AUTH | Session existante (ouverture directe, pas de flash login) | ❌ |
| AUTH | Session expirée (réinitialisation admin) → « Session expirée » | ❌ |
| AUTH | Lien magique / lien collé | ❌ |
| AUTH | SSO Safari (déjà connecté / annulation) | ❌ |
| AUTH | Déconnexion (jeton push détaché, plus de notification) | ❌ |
| LIENS | Apple Mail, Gmail, Outlook, Messages, WhatsApp, Safari | ❌ |
| LIENS | Lien d'un autre club (membre → bascule ; non membre → accès réservé) | ❌ |
| LIENS | Domaine étranger ignoré | ❌ |
| ÉTATS | Démarrage à froid / premier plan / arrière-plan | ❌ |
| PUSH | Permission acceptée / refusée | ❌ |
| PUSH | Jeton enregistré (`development` en build dev) | ❌ |
| PUSH | TestFlight : jeton `production` reçu via APNs de production | ❌ |
| PUSH | Premier plan (bannière, pas de navigation) | ❌ |
| PUSH | Arrière-plan / app tuée / toucher → écran exact | ❌ |
| UI | 375/390/430 px, encoche, Dynamic Type, VoiceOver | ❌ |
| RÉSEAU | Mode avion : bandeau, pas d'écran blanc, retour réseau | ❌ |
