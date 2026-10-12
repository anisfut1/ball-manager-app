# Matrice de parité web → mobile

Statuts : **NATIVE V1** (écran React Native livré) · **NATIVE LATER** · **WEB-ONLY** (assumé, ouvert dans le navigateur via `/web`).
Validation : IMPLEMENTED + UNIT TESTED pour les modèles ; **NOT TESTED ON DEVICE**.

| Route web | Fonction | Rôles | Route mobile | Statut | Raison |
|---|---|---|---|---|---|
| `/public/{club}` · `/accueil` | Centre d'action (réponses, convocations, à venir) | parent, joueur, coach… | `(tabs)/index` | NATIVE V1 | cœur du produit |
| `/public/{club}/planning` | Matchs + entraînements | tous | `(tabs)/planning`, `c/{club}/planning` | NATIVE V1 | timeline par jour |
| `/public/{club}/matchs/{id}` | Détail match, disponibilités | tous | `c/{club}/matchs/{id}` | NATIVE V1 | |
| (convocation du match) | Convocation participant | parent, joueur | `matchs/{id}?section=convocation` | NATIVE V1 | confirmer / refuser |
| (convocation du match) | Builder convocation | coach, admin | `matchs/{id}/convocation` | NATIVE V1 | RDV, lieu, message, aperçu |
| `/public/{club}/entrainements` | Entraînement, réponse, occurrence | tous / coach | `c/{club}/entrainements/{id}` | NATIVE V1 | annulation/modification occurrence |
| (création de séries) | Séries d'entraînement | coach | `equipes/{id}/creneaux` | NATIVE V1 | |
| `/public/{club}/equipes` · `/equipes/{id}` | Équipes : vue, planning, effectif | tous | `(tabs)/equipes`, `equipes/{id}` | NATIVE V1 | |
| (maillots) | Lavage de maillots | coach | feuille dans le match | NATIVE V1 | suggestions, jamais auto-assigné |
| `/public/{club}/tables` | Tables de marque (3 postes) | responsable tables | `c/{club}/tables` | NATIVE V1 | suggestions, jamais auto |
| `/public/{club}/derogations[/…]` | Dérogations : liste, détail, nouvelle | coach, coordinateur | `derogations/index`, `[requestId]`, `nouvelle` | NATIVE V1 | jamais d'écriture FFBB |
| `/public/{club}/connexion/code/{code}` | Lien de connexion | tous | `/code` | NATIVE V1 | |
| `/public/{club}/auth/app` | Page SSO (identification) | tous | — (Safari) | WEB-ONLY | rôle d'identification du protocole |
| `/public/{club}/matchs`, `/resultats` | Listes de résultats | tous | planning (passés) | NATIVE LATER | liste dédiée des résultats |
| `/public/{club}/tables/classement` | Classement des tables | tous | — | NATIVE LATER | |
| `/public/{club}/joueurs/{id}` | Fiche joueur | tous | — | NATIVE LATER | |
| `/c/{club}/dashboard` | Tableau de bord compte | admin | — | WEB-ONLY | espace par compte |
| `/c/{club}/joueurs[/{id}]` | Gestion des licenciés | admin | — | WEB-ONLY | administration |
| `/c/{club}/admin/*` (teams, gymnases, settings, integrations, fbi, sync, issues, stats, derogations) | Administration du club | club_admin | `/web` | WEB-ONLY | FFBB/FBI, imports : hors périmètre mobile V1 |
| `/c/{club}/tables/public-access` | Accès public aux tables | admin | — | WEB-ONLY | administration |
| `/c/{club}/matchs`, `/planning`, `/equipes`, `/derogations`, `/tables` | Équivalents espace compte | comptes | écrans natifs équivalents | NATIVE V1 | redirigés par le résolveur |
| `/platform/clubs[/{id}]` | Plateforme | platform_admin | `/web` | WEB-ONLY | |
| `/login`, `/bienvenue`, `/mot-de-passe-oublie` | Comptes Supabase | admin | `/web` | WEB-ONLY | l'app n'a pas de compte |
| `/confidentialite`, `/support` | Pages légales | public | navigateur intégré (Profil) | WEB-ONLY | |
