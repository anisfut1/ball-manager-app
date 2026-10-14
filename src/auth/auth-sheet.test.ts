import { ApiError } from "@/api/errors";
import { bootstrapFromToken, loginWithCode, ssoLogin, type AuthApi, type AuthDeps } from "./auth-service";
import { SsoCancelled } from "./callback";
import { routeAfterSso } from "./sso-outcome";
import { EMPTY_STATE } from "./session-model";

// Données fictives uniquement.
const TOKEN = "SENTINELLE_TOKEN_0123456789abcdef0123456789";
const CODE = "SENTINELLE_CODE_0123456789abcdef0123456789";
const LINA = { licencieId: "lic-lina", firstName: "Lina", lastName: "Exemple", teamId: "t-u15" };

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    club: async () => ({ name: "Club A", accentColor: null, timezone: "Europe/Paris" }),
    createSession: async () => ({ sessionSecret: "bmd_" + "a".repeat(43), expiresAt: "2027-04-01T00:00:00Z", people: [LINA], redirectPath: null }),
    exchangeCode: async () => ({ sessionSecret: "bmd_" + "b".repeat(43), expiresAt: "2027-04-01T00:00:00Z", people: [LINA], redirectPath: null }),
    session: async () => ({ people: [LINA] }),
    logout: async () => undefined,
    addPeople: async () => ({ people: [LINA] }),
    removePerson: async () => undefined,
    ...overrides,
  };
}

/** Feuille « ouverte » : `openAuthSession` reste en attente ; `dismiss` la résout comme iOS (type `dismiss` → null). */
function sheetDeps(api: AuthApi, { dismissResolvesSheet = true } = {}) {
  let resolveSheet: (url: string | null) => void = () => undefined;
  const dismissAuthSession = jest.fn(() => {
    if (dismissResolvesSheet) resolveSheet(null);
  });
  const deps: AuthDeps = {
    api,
    meta: { appVersion: "1.0.0" },
    createPkce: async () => ({ verifier: "v".repeat(43), challenge: "c".repeat(43), state: "s".repeat(22) }),
    openAuthSession: () => new Promise<string | null>((resolve) => (resolveSheet = resolve)),
    dismissAuthSession,
    webUrl: "https://www.ball-manager.fr",
  };
  return { deps, dismissAuthSession, userClosesSheet: () => resolveSheet(null) };
}

/** Lance « Continuer » et attend que la feuille soit réellement ouverte. */
async function openSheet(deps: AuthDeps) {
  const sso = ssoLogin(deps, EMPTY_STATE, "club-a");
  await new Promise((r) => setImmediate(r));
  return { sso };
}

async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(() => (done = true), () => (done = true));
  await new Promise((r) => setImmediate(r));
  return done;
}

describe("feuille d'authentification : connexion aboutie par lien", () => {
  it("jeton personnel reçu, feuille ouverte : fermée UNE fois, ssoLogin → superseded", async () => {
    const { deps, dismissAuthSession } = sheetDeps(fakeApi());
    const { sso } = await openSheet(deps);
    await bootstrapFromToken(deps, EMPTY_STATE, "club-a", TOKEN);
    expect(dismissAuthSession).toHaveBeenCalledTimes(1);
    await expect(sso).resolves.toMatchObject({ kind: "superseded" });
  });

  it("code de connexion reçu, feuille ouverte : fermée UNE fois, ssoLogin → superseded", async () => {
    const { deps, dismissAuthSession } = sheetDeps(fakeApi());
    const { sso } = await openSheet(deps);
    await loginWithCode(deps, EMPTY_STATE, "club-a", CODE);
    expect(dismissAuthSession).toHaveBeenCalledTimes(1);
    await expect(sso).resolves.toMatchObject({ kind: "superseded" });
  });

  it("aucune feuille ouverte : dismissAuthSession jamais appelé", async () => {
    const { deps, dismissAuthSession } = sheetDeps(fakeApi());
    await bootstrapFromToken(deps, EMPTY_STATE, "club-a", TOKEN);
    await loginWithCode(deps, EMPTY_STATE, "club-a", CODE);
    expect(dismissAuthSession).not.toHaveBeenCalled();
  });

  it("lien refusé, feuille ouverte : feuille laissée ouverte, ssoLogin en attente", async () => {
    const api = fakeApi({ createSession: async () => Promise.reject(new ApiError("unauthorized", "Lien invalide", 401, "TOKEN_INVALID")) });
    const { deps, dismissAuthSession } = sheetDeps(api);
    const { sso } = await openSheet(deps);
    await expect(bootstrapFromToken(deps, EMPTY_STATE, "club-a", TOKEN)).rejects.toBeInstanceOf(ApiError);
    expect(dismissAuthSession).not.toHaveBeenCalled();
    expect(await settled(sso)).toBe(false);
  });

  it("annulation par l'utilisateur sans lien : SsoCancelled, comme avant", async () => {
    const { deps, dismissAuthSession, userClosesSheet } = sheetDeps(fakeApi());
    const { sso } = await openSheet(deps);
    userClosesSheet();
    await expect(sso).rejects.toBeInstanceOf(SsoCancelled);
    expect(dismissAuthSession).not.toHaveBeenCalled();
  });

  it("deux liens successifs, fermeture pas encore effective : un seul appel à dismissAuthSession", async () => {
    const { deps, dismissAuthSession, userClosesSheet } = sheetDeps(fakeApi(), { dismissResolvesSheet: false });
    const { sso } = await openSheet(deps);
    await bootstrapFromToken(deps, EMPTY_STATE, "club-a", TOKEN);
    await loginWithCode(deps, EMPTY_STATE, "club-a", CODE);
    expect(dismissAuthSession).toHaveBeenCalledTimes(1);
    userClosesSheet(); // la feuille finit par se fermer
    await expect(sso).resolves.toMatchObject({ kind: "superseded" });
  });
});

describe("écran de connexion : issue de ssoLogin", () => {
  it("superseded : aucune navigation (null), la route reste celle de /lien ou /code", () => {
    expect(routeAfterSso({ kind: "superseded" }, "club-a")).toBeNull();
  });
  it("connecté : destination habituelle", () => {
    expect(routeAfterSso({ kind: "signed-in", redirectPath: null }, "club-a")).toEqual(expect.any(String));
  });
});
