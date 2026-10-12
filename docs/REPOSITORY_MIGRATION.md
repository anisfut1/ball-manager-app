# Migration des dépôts

Le document de référence détaillé est `docs/REPOSITORY_MIGRATION.md` de `ball-manager-web` et de `ball-manager-back` (branches `claude/ios-app`).

| Avant | Après |
|---|---|
| `anisfut1/SCSB` | `anisfut1/ball-manager-web` |
| `anisfut1/club-manager-api` | `anisfut1/ball-manager-back` |
| (nouveau) | `anisfut1/ball-manager-app` |

- Renommage fait le 2026-10-10 (commits `9c701b6` web, `a511807` back). GitHub redirige les anciens noms.
- Projets Vercel **non renommés** ; domaines inchangés : `www.ball-manager.fr` (web), `club-manager-api-two.vercel.app` (API).
- Branches de travail : web et back `claude/ios-app` ; app `claude/expo-app`.
- Remotes : `ball-manager-app` → `https://github.com/anisfut1/ball-manager-app.git`. Les anciens clones locaux (`SCSB`) pointent encore vers l'ancien nom : `git remote set-url origin https://github.com/anisfut1/ball-manager-web.git`.
