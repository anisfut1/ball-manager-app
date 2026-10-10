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

function timeoutFetch(input: Request): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(new Request(input, { signal: controller.signal })).finally(() => clearTimeout(timer));
}

let client: ReturnType<typeof createClient<paths>> | null = null;

export function api() {
  if (!client) client = createClient<paths>({ baseUrl: requireApiUrl(), fetch: timeoutFetch });
  return client;
}

/** Réservé aux tests : client avec un `fetch` simulé. */
export function setApiClientForTests(next: ReturnType<typeof createClient<paths>> | null): void {
  client = next;
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
