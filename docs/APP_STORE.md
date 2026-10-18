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

| Copyright | à renseigner (titulaire réel) |

**Description (proposition)**

> L'app officielle des clubs de basket qui utilisent Ball Manager. Convocations, disponibilités, entraînements, matchs et résultats de ton équipe, au même endroit.
>
> • Reçois ta convocation et confirme ta présence en un geste.
> • Réponds aux entraînements : présent, absent ou incertain.
> • Suis les changements de match (horaire, salle, report) dès qu'ils sont connus.
> • Un seul iPhone pour toute la famille : ajoute chaque enfant.
> • Matchs de la saison, résultats, classements, statistiques et tables de marque.
> • Coachs : demandes de disponibilités, convocations et relances depuis le téléphone.
>
> Accès réservé aux licenciés des clubs Ball Manager : ton club t'envoie ton lien de connexion par email.

Mots-clés (100 car.) : `basket,club,convocation,entraînement,match,FFBB,équipe,coach,licencié,planning`

## Revue Apple (Guideline 4.2)

Application **React Native native**, pas un site encapsulé (aucune WebView pour le produit) :

- écrans natifs (accueil, planning, match, convocation, entraînements, équipes, tables, dérogations, profil) ;
- notifications push APNs avec ouverture de l'écran exact ;
- Universal Links ;
- connexion Safari (`ASWebAuthenticationSession`, PKCE) ;
- session dans le Keychain, plusieurs enfants et plusieurs clubs.

### Parcours de connexion réel (version actuelle de l'app)

Ball Manager n'a **ni création de compte ni mot de passe** : chaque licencié est déjà connu de son club.

1. **Bienvenue** → « Choisis ton club » (cartes avec logo).
2. **« Qui es-tu ? »** → l'utilisateur tape son nom ; les licenciés correspondants s'affichent au fil de la frappe.
3. Il choisit son nom → le club lui envoie **son lien personnel par email** → le lien ouvre l'app (Universal Link) **déjà connectée**.
4. Variante : **« Continuer avec Ball Manager »** → Safari (ASWebAuthenticationSession + PKCE) si ce navigateur connaît déjà la personne → retour dans l'app connectée.

Le club de démo n'apparaît **jamais** dans « Choisis ton club » (`CLUBS_HIDDEN_FROM_PICKER`, ball-manager-back) : le relecteur y entre par le lien de démo.

### Note pour le relecteur Apple (à coller dans App Store Connect → « Informations de connexion »)

Cocher « Connexion requise », laisser identifiant / mot de passe vides, et coller (remplacer `<LIEN DE DÉMO>` par le lien personnel de « Camille DEMO », **jamais dans le dépôt**) :

> Ball Manager has no accounts and no passwords: each club member is identified by the club and receives a personal sign-in link by email.
>
> To review the app with a demo club (100% fictional data):
> 1. Install the build on the review device.
> 2. On the same device, open this link (tap it, e.g. from Notes or Safari): <LIEN DE DÉMO>
> 3. The link opens Ball Manager already signed in as "Camille DEMO" (player/parent of the "U13 Démo" team in "Club Démo Ball Manager").
>
> You can then browse: Home (to-do answers, upcoming matches), Équipe (team page, planning, roster), Matchs (season calendar, match sheet), Tables (scorer table sign-up), Plus (results and standings, planning, profile).
> In the normal flow, a member picks their club, types their name and receives the same kind of link by email; the demo club is intentionally hidden from the club list.
> Notifications are optional and only requested after sign-in.

**Prérequis avant l'envoi en revue** (dans l'ordre) :
1. Fusionner la branche `claude/app-store-demo` de ball-manager-back (club de démo caché de la liste).
2. Appliquer `ball-manager-back/supabase/seed/demo_review_club.sql` (écriture en base : sur accord explicite).
3. Générer le lien personnel de Camille DEMO, vérifier sur un iPhone qu'il ouvre l'app connectée, puis le coller dans la note ci-dessus (App Store Connect uniquement).

## Suppression de compte (5.1.1(v))

**Implémentée dans l'app, sans écrire au support.** L'app ne crée pas de compte (accès par un lien émis par le club), mais l'accès est supprimable :

- **Où** : onglet *Plus* → *Profil* → tout en bas, section *Compte*, bouton **Supprimer mon compte** (style destructif).
- **Confirmation** : une feuille liste chaque club de l'appareil avec les prénoms de ses profils, ce qui est supprimé, ce qui est conservé, et prévient que l'accès d'un autre parent aux mêmes enfants sera aussi coupé. Rien n'est envoyé avant l'appui sur **Supprimer définitivement**.
- **Supprimé** : l'accès du licencié (tous appareils et web), son e-mail, son téléphone, sa photo et ses rôles ; les jetons push.
- **Conservé** : la fiche sportive gérée par le club (nom, numéro de licence, équipe) pour les feuilles de match et les historiques.
- **Route** : `DELETE /v1/public/clubs/{clubSlug}/auth/me` avec `Authorization: Bearer <session bmd_…>`, **une fois par club, l'un après l'autre**. `204` ou `401` : le club est effacé de l'appareil. Réseau ou `5xx` : le club reste connecté, un message nomme les clubs non supprimés et propose de réessayer. Quand tout est supprimé : retour à l'accueil avec « Ton compte a été supprimé. ».
- ⚠️ **Ne jamais supprimer le licencié du compte de revue Apple pendant les tests** : la suppression est réelle et définitive. Tester avec un autre licencié du club `club-demo` (par exemple Noah EXEMPLE).

## Confidentialité

- **Suivi : Non.** Pas d'IDFA, pas d'ATT, pas de fingerprinting, aucun SDK publicitaire ou d'analytics.
- Données liées à l'identité, pour la fonctionnalité de l'app : nom, email (lien envoyé par le club), identifiant de licencié, identifiant d'appareil (jeton push), réponses et messages de dérogation.
- **Privacy manifest** : `ios.privacyManifests` dans `app.config.ts` déclare les raisons usuelles du socle RN/Expo (UserDefaults `CA92.1`, FileTimestamp, SystemBootTime, DiskSpace). **À confirmer** par le rapport de confidentialité d'Xcode et le courriel d'Apple après le premier TestFlight : non vérifié sur une build réelle. Les modules Expo embarquent leur propre manifeste.
- Permissions : seulement les notifications (demandées sur geste). Aucune caméra, localisation, contacts, photos.
- Chiffrement : `usesNonExemptEncryption: false`.

## Icône

`assets/images/icon.png` : 1024 × 1024, **sans canal alpha** — logo **BM** officiel (ballon orange sur tuile noire, le même que le site : `ball-manager-web/public/icon-512.png`), agrandi depuis 512 px (source la plus grande disponible) et affiné. Écran de démarrage : même logo sur fond `#111111` (aucun bord visible). Android : icône adaptative cohérente. Si un fichier source vectoriel (SVG / AI) du logo existe, régénérer depuis lui pour une netteté parfaite.

## Captures 6,9"

Accueil « À faire », match + convocation, planning, entraînement, profil (plusieurs enfants), notification verrouillée, builder de convocation, bienvenue — sur le club de démo.

## Divers

Resend : suivi des clics **désactivé** (sinon les liens email n'ouvrent pas l'app). `NEXT_PUBLIC_APP_STORE_ID` (web) après publication pour le Smart App Banner. EAS Submit prêt (`eas.json`), **aucune soumission effectuée**.
