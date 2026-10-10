import type { components } from "./generated/schema";

/** Raccourci vers les DTO générés depuis l'OpenAPI de ball-manager-back (jamais recopiés à la main). */
export type Schemas = components["schemas"];
export type Dto<K extends keyof Schemas> = Schemas[K];
