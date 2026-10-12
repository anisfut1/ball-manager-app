# Étapes manuelles

Uniquement ce qui ne peut pas être fait depuis le code. Aucune soumission ni build n'a été faite à ce stade.

1. **Fusionner/déployer** les branches `claude/ios-app` de `ball-manager-web` et `ball-manager-back` (Vercel).
2. **AASA** : vérifier `https://www.ball-manager.fr/.well-known/apple-app-site-association` (200, `application/json`, sans redirection). Pour ajouter `ball-manager.fr`, vérifier pareil puis définir `BM_ASSOCIATED_DOMAINS`.
3. **Resend** : désactiver le suivi des clics.
4. **Clé APNs `.p8`** (Apple Developer → Keys) puis variables Vercel de `ball-manager-back` : `APNS_TEAM_ID=YFZ72KY47V`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`.
5. **Compte Expo** : `npx eas-cli login`, `eas init` (renseigne `EAS_PROJECT_ID`, `EXPO_OWNER`), identifiants iOS (laisser EAS gérer la signature).
6. **Development Build** : `npx eas-cli build --profile development --platform ios`, installer sur un vrai iPhone, dérouler `docs/IOS_TEST_MATRIX.md`.
7. **Icône définitive** 1024 × 1024 sans transparence (remplace `assets/images/icon.png`).
8. **Support/pages légales** : `NEXT_PUBLIC_SUPPORT_EMAIL` (web), relecture de `/confidentialite`.
9. **Club de démo** : appliquer `supabase/seed/demo_review_club.sql`, générer le lien de revue.
10. **App Store Connect** : créer l'app, build `production`, `eas submit`, TestFlight (tests push production), captures, notes de revue, soumission.
11. Après publication : `NEXT_PUBLIC_APP_STORE_ID` (web).
12. Mettre à jour les remotes des anciens clones locaux (voir `docs/REPOSITORY_MIGRATION.md`).
