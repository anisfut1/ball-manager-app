/**
 * Erreurs API → messages humains. Le backend renvoie toujours
 * `{ error: { code, message } }` avec un message français déjà lisible pour
 * les erreurs métier (4xx) : on le garde. On ne montre jamais « HTTP 409 ».
 */
export type ApiErrorKind = "offline" | "timeout" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "validation" | "rate_limited" | "server";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** La session de cet appareil n'est plus valable (lien réinitialisé, déconnexion ailleurs, expiration). */
  get sessionExpired(): boolean {
    return this.status === 401 && (this.code === "SESSION_INVALID" || this.code === "SESSION_REQUIRED");
  }
}

const FALLBACK: Record<ApiErrorKind, string> = {
  offline: "Pas de connexion internet. Vérifie ton réseau puis réessaie.",
  timeout: "Le serveur met trop de temps à répondre. Réessaie dans un instant.",
  unauthorized: "Ta session a expiré. Reconnecte-toi.",
  forbidden: "Tu n'as pas accès à cette action.",
  not_found: "Cet élément n'existe plus ou n'est plus accessible.",
  conflict: "Cette action n'est plus possible : la situation a changé entre-temps.",
  validation: "Certaines informations sont incomplètes ou invalides.",
  rate_limited: "Trop de tentatives. Réessaie dans une minute.",
  server: "Le service est momentanément indisponible. Réessaie dans un instant.",
};

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status === 429) return "rate_limited";
  return "server";
}

interface ErrorBody {
  error?: { code?: unknown; message?: unknown };
}

/** Construit l'erreur à partir de la réponse HTTP et de son corps éventuel. */
export function apiErrorFrom(status: number, body: unknown): ApiError {
  const kind = kindForStatus(status);
  const err = (body as ErrorBody | null)?.error;
  const code = typeof err?.code === "string" ? err.code : null;
  const serverMessage = typeof err?.message === "string" && err.message.trim() ? err.message.trim() : null;
  // 5xx : jamais le détail technique du serveur.
  const message = kind === "server" ? FALLBACK.server : (serverMessage ?? FALLBACK[kind]);
  return new ApiError(kind, message, status, code);
}

export function networkError(cause: unknown): ApiError {
  const aborted = cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError");
  return aborted ? new ApiError("timeout", FALLBACK.timeout, 0) : new ApiError("offline", FALLBACK.offline, 0);
}

/** Message à afficher pour n'importe quelle erreur (jamais de stack ni de code HTTP). */
export function humanMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Une erreur inattendue est survenue. Réessaie.";
}
