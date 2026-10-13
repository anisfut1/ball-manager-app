import { ApiError, apiErrorFrom, humanMessage, networkError } from "./errors";

describe("erreurs API", () => {
  it("garde le message métier du serveur (409 : créneau pris)", () => {
    const e = apiErrorFrom(409, { error: { code: "SLOT_TAKEN", message: "Ce créneau vient d'être occupé." } });
    expect(e.kind).toBe("conflict");
    expect(e.code).toBe("SLOT_TAKEN");
    expect(humanMessage(e)).toBe("Ce créneau vient d'être occupé.");
  });

  it("5xx : jamais le détail technique", () => {
    const e = apiErrorFrom(500, { error: { code: "INTERNAL_ERROR", message: "TypeError at line 42" } });
    expect(e.message).not.toMatch(/TypeError|500|line/);
    expect(e.kind).toBe("server");
  });

  it("corps absent : message de repli humain par statut", () => {
    expect(apiErrorFrom(403, null).message).toBe("Tu n'as pas accès à cette action.");
    expect(apiErrorFrom(422, "oops").kind).toBe("validation");
    expect(apiErrorFrom(429, {}).kind).toBe("rate_limited");
    expect(apiErrorFrom(404, {}).message).not.toMatch(/404/);
  });

  it("401 SESSION_INVALID = session expirée ; autre 401 non", () => {
    expect(apiErrorFrom(401, { error: { code: "SESSION_INVALID", message: "x" } }).sessionExpired).toBe(true);
    expect(apiErrorFrom(401, { error: { code: "INVALID_PERSONAL_LINK", message: "x" } }).sessionExpired).toBe(false);
  });

  it("réseau coupé / délai dépassé", () => {
    expect(networkError(new TypeError("Network request failed")).kind).toBe("offline");
    const timeout = new Error("t");
    timeout.name = "AbortError";
    expect(networkError(timeout).kind).toBe("timeout");
    const missing = new Error("EXPO_PUBLIC_API_URL manquant");
    missing.name = "MissingConfigError";
    expect(networkError(missing).kind).toBe("server");
    expect(networkError(missing).code).toBe("MISSING_CONFIG");
    expect(humanMessage(new Error("boom"))).toBe("Une erreur inattendue est survenue. Réessaie.");
    expect(new ApiError("offline", "m", 0)).toBeInstanceOf(Error);
  });
});
