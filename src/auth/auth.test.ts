import { createHash } from "node:crypto";
import { ApiError } from "@/api/errors";
import { base64url } from "./base64url";
import { createPkce } from "./pkce";
import { parseSsoCallback, SSO_CALLBACK, SsoCancelled, SsoInvalid } from "./callback";
import { bootstrapFromToken, loginWithCode, logout, refreshAll, removePerson, ssoLogin, ssoUrl, type AuthApi, type AuthDeps } from "./auth-service";
import { activePerson, EMPTY_STATE, parseState, serializeState, withActiveClub, withActivePerson, type ClubSession, type SessionState } from "./session-model";
import { sessionReducer } from "./session-machine";
import { memoryStorage } from "./secure-storage";
import { createSessionRepository, SESSION_KEY } from "./session-repository";

// Données fictives uniquement.
const SECRET_A = "bmd_" + "a".repeat(43);
const SECRET_B = "bmd_" + "b".repeat(43);
const LINA = { licencieId: "lic-lina", firstName: "Lina", lastName: "Exemple", teamId: "t-u15" };
const HUGO = { licencieId: "lic-hugo", firstName: "Hugo", lastName: "Exemple", teamId: "t-u11" };

function club(slug: string, secret: string, people = [LINA]): ClubSession {
  return { clubSlug: slug, clubName: slug.toUpperCase(), accentColor: null, timezone: "Europe/Paris", secret, people, activeLicencieId: people[0]?.licencieId ?? null };
}

function fakeApi(overrides: Partial<AuthApi> = {}): AuthApi & { calls: string[] } {
  const calls: string[] = [];
  const api: AuthApi = {
    club: async (slug) => (calls.push(`club:${slug}`), { name: `Club ${slug}`, accentColor: "#C8102E", timezone: "Europe/Paris" }),
    createSession: async (slug, tokens) => (calls.push(`create:${slug}:${tokens.length}`), { sessionSecret: SECRET_A, expiresAt: "2027-04-01T00:00:00Z", people: [LINA], redirectPath: null }),
    exchangeCode: async (slug, code, verifier) => (calls.push(`exchange:${slug}:${code}:${verifier ?? "-"}`), { sessionSecret: SECRET_B, expiresAt: "2027-04-01T00:00:00Z", people: [LINA], redirectPath: `/public/${slug}/matchs/m1` }),
    session: async () => ({ people: [LINA] }),
    logout: async (slug) => calls.push(`logout:${slug}`),
    addPeople: async (slug) => (calls.push(`add:${slug}`), { people: [LINA, HUGO] }),
    removePerson: async (slug, _s, id) => calls.push(`remove:${slug}:${id}`),
    ...overrides,
  };
  return Object.assign(api, { calls });
}

function deps(api: AuthApi, openAuthSession: AuthDeps["openAuthSession"] = async () => null): AuthDeps {
  return { api, meta: { appVersion: "1.0.0" }, createPkce: async () => ({ verifier: "v".repeat(43), challenge: "c".repeat(43), state: "s".repeat(22) }), openAuthSession, webUrl: "https://www.ball-manager.fr" };
}

describe("PKCE (RFC 7636)", () => {
  it("vecteur de test officiel de la RFC (annexe B)", async () => {
    const rfcBytes = new Uint8Array([116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121]);
    const pkce = await createPkce({ randomBytes: (n) => (n === 32 ? rfcBytes : new Uint8Array(n)), sha256: async (d) => new Uint8Array(createHash("sha256").update(d).digest()) });
    expect(pkce.verifier).toBe("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(pkce.challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(pkce.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("base64url sans remplissage", () => {
    expect(base64url(new Uint8Array([0xfb, 0xff]))).toBe("-_8");
    expect(base64url(new Uint8Array([]))).toBe("");
  });
});

describe("rappel SSO", () => {
  const ok = `${SSO_CALLBACK}?code=${"k".repeat(43)}&state=abc`;
  it("accepte le bon rappel et le bon state", () => expect(parseSsoCallback(ok, "abc")).toEqual({ code: "k".repeat(43) }));
  it("rejette un state différent, un autre schéma, un code absent", () => {
    expect(() => parseSsoCallback(ok, "autre")).toThrow(SsoInvalid);
    expect(() => parseSsoCallback(`evil://auth/callback?code=${"k".repeat(43)}&state=abc`, "abc")).toThrow(SsoInvalid);
    expect(() => parseSsoCallback(`${SSO_CALLBACK}?state=abc`, "abc")).toThrow(SsoInvalid);
  });
  it("refus côté web (error=…) : annulation, pas une erreur", () => expect(() => parseSsoCallback(`${SSO_CALLBACK}?error=access_denied&state=abc`, "abc")).toThrow(SsoCancelled));
  it("URL de la page web : rappel fixe attendu par ball-manager-web, destination conservée", () => {
    const url = new URL(ssoUrl("https://www.ball-manager.fr", "club-a", { verifier: "v", challenge: "c".repeat(43), state: "s".repeat(22) }, "/public/club-a/matchs/m1"));
    expect(url.pathname).toBe("/public/club-a/auth/app");
    expect(url.searchParams.get("redirect_uri")).toBe("fr.ballmanager.app://auth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_path")).toBe("/public/club-a/matchs/m1");
  });
});

describe("modèle de session", () => {
  it("données corrompues ou d'un autre format : état vide, jamais un plantage", () => {
    expect(parseState("{oops")).toEqual(EMPTY_STATE);
    expect(parseState(JSON.stringify({ v: 2 }))).toEqual(EMPTY_STATE);
    expect(parseState(JSON.stringify({ v: 1, active: "x", clubs: { x: { ...club("x", "pas-un-secret") } } }))).toEqual(EMPTY_STATE);
  });
  it("aller-retour et club actif réparé s'il n'existe plus", () => {
    const state: SessionState = { v: 1, active: "disparu", clubs: { "club-a": club("club-a", SECRET_A) } };
    expect(parseState(serializeState(state)).active).toBe("club-a");
  });
  it("personne active : choix mémorisé, sinon la première", () => {
    const s = withActivePerson({ v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A, [LINA, HUGO]) } }, "club-a", "lic-hugo");
    expect(activePerson(s.clubs["club-a"]!)?.firstName).toBe("Hugo");
    expect(withActivePerson(s, "club-a", "inconnu")).toBe(s);
    expect(withActiveClub(s, "club-z")).toBe(s);
  });
});

describe("machine d'états", () => {
  const signed: SessionState = { v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A) } };
  it("démarrage : sessions → AUTHENTICATED tout de suite (hors ligne compris) ; sinon UNAUTHENTICATED", () => {
    expect(sessionReducer({ status: "BOOTING", state: EMPTY_STATE }, { type: "BOOTED", state: signed }).status).toBe("AUTHENTICATED");
    expect(sessionReducer({ status: "BOOTING", state: EMPTY_STATE }, { type: "BOOTED", state: EMPTY_STATE }).status).toBe("UNAUTHENTICATED");
  });
  it("revalidation : toutes refusées → EXPIRED (message « reconnecte-toi »)", () => {
    const refreshing = sessionReducer({ status: "AUTHENTICATED", state: signed }, { type: "REFRESH_STARTED" });
    expect(refreshing.status).toBe("REFRESHING");
    expect(sessionReducer(refreshing, { type: "REFRESHED", state: EMPTY_STATE, expiredClubs: ["club-a"] }).status).toBe("EXPIRED");
    expect(sessionReducer(refreshing, { type: "REFRESHED", state: signed, expiredClubs: [] }).status).toBe("AUTHENTICATED");
  });
  it("401 en cours d'usage sur le dernier club → EXPIRED ; déconnexion volontaire → UNAUTHENTICATED", () => {
    expect(sessionReducer({ status: "AUTHENTICATED", state: signed }, { type: "SESSION_INVALID", state: EMPTY_STATE }).status).toBe("EXPIRED");
    expect(sessionReducer({ status: "AUTHENTICATED", state: signed }, { type: "SIGNED_OUT", state: EMPTY_STATE }).status).toBe("UNAUTHENTICATED");
  });
});

describe("services d'authentification", () => {
  it("lien personnel : session créée, jeton NON conservé, infos du club (accent, fuseau)", async () => {
    const api = fakeApi();
    const state = await bootstrapFromToken(deps(api), EMPTY_STATE, "club-a", "token-lina-0000");
    expect(state.active).toBe("club-a");
    expect(state.clubs["club-a"]).toMatchObject({ secret: SECRET_A, accentColor: "#C8102E", timezone: "Europe/Paris" });
    expect(serializeState(state)).not.toContain("token-lina-0000");
  });

  it("déjà connecté au club : le lien d'un autre enfant l'AJOUTE", async () => {
    const api = fakeApi();
    const state = await bootstrapFromToken(deps(api), { v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A) } }, "club-a", "token-hugo-0000");
    expect(api.calls).toContain("add:club-a");
    expect(state.clubs["club-a"]!.people.map((p) => p.firstName)).toEqual(["Lina", "Hugo"]);
  });

  it("lien de connexion à usage unique : destination renvoyée par l'API", async () => {
    const result = await loginWithCode(deps(fakeApi()), EMPTY_STATE, "club-a", "c".repeat(43));
    expect(result.redirectPath).toBe("/public/club-a/matchs/m1");
  });

  it("SSO : verifier envoyé à l'échange ; annulation par l'utilisateur = SsoCancelled", async () => {
    const api = fakeApi();
    const callback = `${SSO_CALLBACK}?code=${"k".repeat(43)}&state=${"s".repeat(22)}`;
    const result = await ssoLogin(deps(api, async () => callback), EMPTY_STATE, "club-a");
    expect(api.calls).toContain(`exchange:club-a:${"k".repeat(43)}:${"v".repeat(43)}`);
    expect(result.state.clubs["club-a"]?.secret).toBe(SECRET_B);
    await expect(ssoLogin(deps(api, async () => null), EMPTY_STATE, "club-a")).rejects.toBeInstanceOf(SsoCancelled);
  });

  it("revalidation : 401 → club oublié ; hors ligne → session gardée", async () => {
    const state: SessionState = { v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A), "club-b": club("club-b", SECRET_B) } };
    const api = fakeApi({
      session: async (slug) => {
        if (slug === "club-a") throw new ApiError("unauthorized", "x", 401, "SESSION_INVALID");
        throw new ApiError("offline", "x", 0);
      },
    });
    const result = await refreshAll(deps(api), state);
    expect(result.expiredClubs).toEqual(["club-a"]);
    expect(Object.keys(result.state.clubs)).toEqual(["club-b"]);
    expect(result.state.active).toBe("club-b");
  });

  it("déconnexion : jeton push détaché AVANT la révocation, puis club retiré", async () => {
    const order: string[] = [];
    const api = fakeApi({ logout: async () => order.push("logout") });
    const state = await logout(deps(api), { v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A) } }, "club-a", async () => {
      order.push("push");
    });
    expect(order).toEqual(["push", "logout"]);
    expect(state).toEqual(EMPTY_STATE);
  });

  it("retirer la dernière personne = déconnexion du club", async () => {
    const api = fakeApi();
    const state = await removePerson(deps(api), { v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A) } }, "club-a", "lic-lina");
    expect(api.calls).toContain("logout:club-a");
    expect(state.clubs["club-a"]).toBeUndefined();
  });
});

describe("stockage sécurisé", () => {
  it("un seul enregistrement ; supprimé quand plus aucun club", async () => {
    const storage = memoryStorage();
    const repo = createSessionRepository(storage);
    await repo.save({ v: 1, active: "club-a", clubs: { "club-a": club("club-a", SECRET_A) } });
    expect(Object.keys(storage.dump())).toEqual([SESSION_KEY]);
    expect((await repo.load()).active).toBe("club-a");
    await repo.save(EMPTY_STATE);
    expect(storage.dump()).toEqual({});
  });
});
