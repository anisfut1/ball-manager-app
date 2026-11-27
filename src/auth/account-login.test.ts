import { clubSlugOfUrl } from "@/api/credentials";
import { resolveDestination, internalPathFor } from "@/linking/resolveDestination";
import { accountLogin, ensureFreshAccount, logout, refreshAll, type AccountServiceApi, type AuthApi, type AuthDeps } from "./auth-service";
import { EMPTY_STATE, parseState, serializeState, withClub, type ClubSession } from "./session-model";

// Comptes (email + mot de passe) : données fictives uniquement.
const JWT = "aaa.bbb.ccc";
const JWT2 = "ddd.eee.fff";
const LEGACY = "bmd_" + "a".repeat(43);
const LINA = { licencieId: "lic-lina", firstName: "Lina", lastName: "Exemple", teamId: "t-u15" };
const dto = (accessToken = JWT, expiresAt = "2030-01-01T00:00:00Z") => ({ accessToken, refreshToken: "refresh-1", expiresAt, user: { id: "u1", email: "parent@example.test" } });

function setup(people: { licencieId: string; status: "active" | "pending" }[] = [{ licencieId: LINA.licencieId, status: "active" }]) {
  const calls: string[] = [];
  const toAccount = () => ({ id: "u1", email: "parent@example.test", people: people.map((p) => ({ ...LINA, licencieId: p.licencieId, status: p.status })) });
  const account: AccountServiceApi = {
    get: async () => (calls.push("get"), toAccount()),
    importDeviceSession: async (_slug, _token, secret) => (calls.push(`import:${secret.slice(0, 4)}`), toAccount()),
    refresh: async () => (calls.push("refresh"), dto(JWT2, "2031-01-01T00:00:00Z")),
  };
  const api = {
    club: async () => ({ name: "Club A", accentColor: null, timezone: "Europe/Paris" }),
    logout: async () => calls.push("logout-legacy"),
    session: async () => ({ people: [LINA] }),
  } as unknown as AuthApi;
  const deps = { api, account, meta: {}, createPkce: async () => ({ verifier: "", challenge: "", state: "" }), openAuthSession: async () => null, webUrl: "https://www.ball-manager.fr" } as AuthDeps;
  return { deps, calls };
}

describe("connexion par compte", () => {
  it("ouvre le club avec les licenciés ACTIFS, jetons gardés pour le rafraîchissement", async () => {
    const { deps } = setup();
    const result = await accountLogin(deps, EMPTY_STATE, "club-a", dto());
    expect(result).toMatchObject({ active: 1, pending: 0 });
    const session = result.state.clubs["club-a"]!;
    expect(session.secret).toBe(JWT);
    expect(session.account).toEqual({ refreshToken: "refresh-1", expiresAt: "2030-01-01T00:00:00Z", email: "parent@example.test" });
    // Survit au trousseau (relu tel quel).
    expect(parseState(serializeState(result.state)).clubs["club-a"]?.account?.email).toBe("parent@example.test");
  });

  it("seulement en attente : rien n'est ouvert", async () => {
    const { deps } = setup([{ licencieId: "lic-x", status: "pending" }]);
    const result = await accountLogin(deps, EMPTY_STATE, "club-a", dto());
    expect(result).toMatchObject({ active: 0, pending: 1, state: EMPTY_STATE });
  });

  it("reprend une session d'appareil existante puis la révoque", async () => {
    const { deps, calls } = setup();
    const legacy: ClubSession = { clubSlug: "club-a", clubName: "A", accentColor: null, timezone: "Europe/Paris", secret: LEGACY, people: [LINA], activeLicencieId: LINA.licencieId };
    const result = await accountLogin(deps, withClub(EMPTY_STATE, legacy), "club-a", dto());
    expect(calls).toEqual(["import:bmd_", "logout-legacy"]);
    expect(result.state.clubs["club-a"]?.secret).toBe(JWT);
  });

  it("rafraîchit un jeton qui expire, garde un jeton encore valable", async () => {
    const { deps, calls } = setup();
    const { state } = await accountLogin(deps, EMPTY_STATE, "club-a", dto(JWT, "2030-01-01T00:00:00Z"));
    expect(await ensureFreshAccount(deps, state, "club-a", Date.parse("2029-12-31T00:00:00Z"))).toBe(state);
    const fresh = await ensureFreshAccount(deps, state, "club-a", Date.parse("2029-12-31T23:59:30Z"));
    expect(fresh.clubs["club-a"]?.secret).toBe(JWT2);
    expect(calls).toContain("refresh");
  });

  it("revalidation : plus aucun licencié suivi = club retiré", async () => {
    const one = setup();
    const { state } = await accountLogin(one.deps, EMPTY_STATE, "club-a", dto());
    const none = setup([]);
    const result = await refreshAll(none.deps, state);
    expect(result.expiredClubs).toEqual(["club-a"]);
  });

  it("déconnexion d'un compte : aucune révocation de session d'appareil", async () => {
    const { deps, calls } = setup();
    const { state } = await accountLogin(deps, EMPTY_STATE, "club-a", dto());
    const next = await logout(deps, state, "club-a");
    expect(next.clubs["club-a"]).toBeUndefined();
    expect(calls).not.toContain("logout-legacy");
  });
});

describe("liens et en-têtes", () => {
  it("club d'une URL d'API publique", () => {
    expect(clubSlugOfUrl("https://api.example.com/v1/public/clubs/club-a/account")).toBe("club-a");
    expect(clubSlugOfUrl("https://api.example.com/v1/clubs/abc/matches")).toBeNull();
  });

  it("invitation d'un proche : écran dédié, code du fragment", () => {
    const destination = resolveDestination("https://www.ball-manager.fr/public/club-a/invitation#abcdefghijklmnopqrstuv");
    expect(destination).toEqual({ kind: "invitation", clubSlug: "club-a", code: "abcdefghijklmnopqrstuv" });
    expect(internalPathFor(destination)).toBe("/invitation?club=club-a&code=abcdefghijklmnopqrstuv");
  });
});
