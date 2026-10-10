#!/usr/bin/env node
/**
 * Régénère src/api/generated/schema.ts depuis le contrat OpenAPI RÉEL de
 * ball-manager-back (source de vérité). Aucun DTO n'est recopié à la main.
 *
 * Source (dans l'ordre) :
 *   1. BM_OPENAPI_SOURCE : URL (`https://…/openapi.json`) ou chemin d'un fichier JSON ;
 *   2. l'API de production : https://club-manager-api-two.vercel.app/openapi.json
 *      (domaine Vercel historique du projet ball-manager-back).
 *
 * openapi-typescript 7 exige TypeScript 5 alors que l'app (SDK Expo 57) est en
 * TypeScript 6 : le générateur tourne donc via `npx`, dans un environnement
 * isolé avec son propre TypeScript 5, sans devenir une dépendance de l'app
 * (pas de --force / --legacy-peer-deps). La sortie n'est que des types.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUTPUT = "src/api/generated/schema.ts";
const source = process.env.BM_OPENAPI_SOURCE || "https://club-manager-api-two.vercel.app/openapi.json";

console.log(`[api:generate] contrat OpenAPI : ${source}`);
mkdirSync(dirname(OUTPUT), { recursive: true });
const result = spawnSync(
  "npx",
  ["-y", "--package=openapi-typescript@7.13.0", "--package=typescript@5.9.3", "openapi-typescript", source, "-o", OUTPUT],
  { stdio: "inherit" },
);
if (result.status !== 0) {
  console.error("[api:generate] échec : vérifier BM_OPENAPI_SOURCE (ou lancer ball-manager-back en local et pointer sur http://localhost:3001/openapi.json).");
  process.exit(result.status ?? 1);
}
const banner = `/**
 * AUTO-GENERATED — NE PAS MODIFIER.
 * Généré depuis le contrat OpenAPI de ball-manager-back par \`npm run api:generate\`.
 */
`;
writeFileSync(OUTPUT, banner + readFileSync(OUTPUT, "utf8"));
console.log(`[api:generate] ${OUTPUT} écrit.`);
