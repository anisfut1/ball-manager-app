import createClient from "openapi-fetch";
import { requireApiUrl } from "@/config/env";
import type { paths } from "./generated/schema";
import { ApiError, apiErrorFrom, networkError } from "./errors";
import { credentialHeaders, reportSessionInvalid } from "./credentials";

/**
 * Client UNIQUE vers ball-manager-back, typé par le contrat OpenAPI généré
 * (`npm run api:generate`). Les écrans n'appellent jamais `fetch` : ils
 * passent par src/api/endpoints.ts + TanStack Query.
 */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Envoi sur FBI (dérogation officielle, réponse) : connexion + envoi, ou
 * attente du poste du club (jusqu'à 2 min côté serveur). 20 s coupait des
 * envois pourtant réussis (constaté le 2026-10-20, match n°9327).
 */
const FBI_WRITE_TIMEOUT_MS = 150_000;

/**
 * Administration (2026-10-22) : synchro FFBB, traitement des jobs FBI,
 * vérification de toutes les dérogations — jusqu'à ~4-5 min côté serveur
 * (plafond Vercel 300 s), même délai que le site.
 */
const ADMIN_LONG_TIMEOUT_MS = 280_000;

function timeoutFetch(timeoutMs: number) {
  return (input: Request): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(new Request(input, { signal: controller.signal })).finally(() => clearTimeout(timer));
  };
}

type Client = ReturnType<typeof createClient<paths>>;

let client: Client | null = null;
let fbiWriteClient: Client | null = null;
let adminLongClient: Client | null = null;
let testClient: Client | null = null;

export function api() {
  if (testClient) return testClient;
  if (!client) client = createClient<paths>({ baseUrl: requireApiUrl(), fetch: timeoutFetch(REQUEST_TIMEOUT_MS) });
  return client;
}

/** Même API, délai long : écritures sur FBI uniquement. */
export function fbiWriteApi() {
  if (testClient) return testClient;
  if (!fbiWriteClient) fbiWriteClient = createClient<paths>({ baseUrl: requireApiUrl(), fetch: timeoutFetch(FBI_WRITE_TIMEOUT_MS) });
  return fbiWriteClient;
}

/** Même API, délai de 280 s : opérations d'administration longues (FFBB, FBI). */
export function adminLongApi() {
  if (testClient) return testClient;
  if (!adminLongClient) adminLongClient = createClient<paths>({ baseUrl: requireApiUrl(), fetch: timeoutFetch(ADMIN_LONG_TIMEOUT_MS) });
  return adminLongClient;
}

/** Réservé aux tests : client avec un `fetch` simulé. */
export function setApiClientForTests(next: Client | null): void {
  testClient = next;
}

/** En-têtes d'authentification de la session d'appareil du club (+ personne active). */
export function auth(clubSlug: string, actAs?: string | null) {
  return credentialHeaders(clubSlug, actAs);
}

interface FetchResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Exécute un appel et renvoie `data`, ou lève une ApiError humaine.
 * 401 « session invalide » : signale au SessionProvider (état EXPIRED).
 */
export async function call<T>(clubSlug: string | null, run: () => Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await run();
  } catch (cause) {
    throw networkError(cause);
  }
  if (result.response.ok) return result.data as T;
  const error = apiErrorFrom(result.response.status, result.error);
  if (clubSlug && error.sessionExpired) reportSessionInvalid(clubSlug);
  throw error;
}

export { ApiError };
