# Publication App Store — Ball Manager (Expo / React Native)

Bundle ID `fr.ballmanager.app`, Team ID `YFZ72KY47V`. Étapes manuelles : `MANUAL_STEPS.md`.

## Fiche (proposition)

| Champ | Valeur |
|---|---|
| Nom | Ball Manager |
| Sous-titre | Convocations et vie du club |
| Catégorie | Sports (secondaire : Productivité) |
| Âge | 4+ |
| Prix | Gratuit, sans achat intégré |
| Confidentialité | `https://www.ball-manager.fr/confidentialite` |
| Assistance | `https://www.ball-manager.fr/support` |

Description et mots-clés : reprendre `ball-manager-web/docs/APP_STORE.md` (inchangés).

## Revue Apple (Guideline 4.2)

Application **React Native native**, pas un site encapsulé (aucune WebView pour le produit) :

- écrans natifs (accueil, planning, match, convocation, entraînements, équipes, tables, dérogations, profil) ;
- notifications push APNs avec ouverture de l'écran exact ;
- Universal Links ;
- connexion Safari (`ASWebAuthenticationSession`, PKCE) ;
- session dans le Keychain, plusieurs enfants et plusieurs clubs.

**Note de connexion (à compléter)** : Ball Manager n'a pas de création de compte ; chaque club envoie un lien personnel. Un club de démonstration aux données fictives existe (`ball-manager-back/supabase/seed/demo_review_club.sql`, préparé, à appliquer). Ouvrir l'app → « J'ai reçu un lien Ball Manager » → coller `<LIEN DE DÉMO, jamais dans le dépôt>`. Rôles de démo : parent (Camille DEMO) ; coach et admin à vérifier dans le seed.

## Suppression de compte (5.1.1(v))

**Non applicable** : aucune création de compte, pas de Sign in with Apple ni de login social. « Se déconnecter » révoque la session et le jeton push ; la suppression de données passe par le club (page Confidentialité). **À réauditer** si un jour l'app crée des comptes.

## Confidentialité

- **Suivi : Non.** Pas d'IDFA, pas d'ATT, pas de fingerprinting, aucun SDK publicitaire ou d'analytics.
- Données liées à l'identité, pour la fonctionnalité de l'app : nom, email (lien envoyé par le club), identifiant de licencié, identifiant d'appareil (jeton push), réponses et messages de dérogation.
- **Privacy manifest** : `ios.privacyManifests` dans `app.config.ts` déclare les raisons usuelles du socle RN/Expo (UserDefaults `CA92.1`, FileTimestamp, SystemBootTime, DiskSpace). **À confirmer** par le rapport de confidentialité d'Xcode et le courriel d'Apple après le premier TestFlight : non vérifié sur une build réelle. Les modules Expo embarquent leur propre manifeste.
- Permissions : seulement les notifications (demandées sur geste). Aucune caméra, localisation, contacts, photos.
- Chiffrement : `usesNonExemptEncryption: false`.

## Icône

`assets/images/icon.png` : 1024 × 1024, **sans canal alpha**, mais toujours l'icône **provisoire** (agrandie depuis 512 px). Fournir l'icône définitive (aucun logo n'a été inventé).

## Captures 6,9"

Accueil « À faire », match + convocation, planning, entraînement, profil (plusieurs enfants), notification verrouillée, builder de convocation, bienvenue — sur le club de démo.

## Divers

Resend : suivi des clics **désactivé** (sinon les liens email n'ouvrent pas l'app). `NEXT_PUBLIC_APP_STORE_ID` (web) après publication pour le Smart App Banner. EAS Submit prêt (`eas.json`), **aucune soumission effectuée**.
