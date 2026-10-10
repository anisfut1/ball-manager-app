import { createDeduper, internalPathFor, resolveDestination } from "./resolveDestination";
import { normalizePath } from "./normalizeIncomingUrl";
import { clearPendingDestination, peekPendingDestination, setPendingDestination, takePendingDestination } from "./pendingDestination";

const W = "https://www.ball-manager.fr";

describe("résolveur de liens (Universal Links, schéma, push)", () => {
  it("convocation reçue par email → écran du match, section convocation", () => {
    expect(resolveDestination(`${W}/public/sc-sete/matchs/m1#convocation`)).toEqual({ kind: "route", clubSlug: "sc-sete", route: "/c/sc-sete/matchs/m1?section=convocation" });
    expect(resolveDestination(`${W}/public/sc-sete/matchs/m1#vie-equipe`)).toEqual({ kind: "route", clubSlug: "sc-sete", route: "/c/sc-sete/matchs/m1?section=coach" });
  });

  it("destination d'une notification (chemin relatif) : même résolveur", () => {
    expect(resolveDestination("/public/sc-sete/matchs/m1#convocation")).toEqual(resolveDestination(`${W}/public/sc-sete/matchs/m1#convocation`));
    expect(resolveDestination("/public/sc-sete/accueil#seance-o1")).toEqual({ kind: "route", clubSlug: "sc-sete", route: "/c/sc-sete/entrainements/o1" });
    expect(resolveDestination("/public/sc-sete/derogations/r1")).toEqual({ kind: "route", clubSlug: "sc-sete", route: "/c/sc-sete/derogations/r1" });
  });

  it("anciens liens web : entraînements (coach), équipes, tables, planning, compte", () => {
    expect(resolveDestination(`${W}/public/sc-sete/entrainements?equipe=t1&seance=o1`)).toMatchObject({ route: "/c/sc-sete/entrainements/o1" });
    expect(resolveDestination(`${W}/public/sc-sete/entrainements?equipe=t1`)).toMatchObject({ route: "/c/sc-sete/equipes/t1?tab=planning" });
    expect(resolveDestination(`${W}/public/sc-sete/equipes/t1`)).toMatchObject({ route: "/c/sc-sete/equipes/t1" });
    expect(resolveDestination(`${W}/public/sc-sete/tables`)).toMatchObject({ route: "/c/sc-sete/tables" });
    expect(resolveDestination(`${W}/public/sc-sete/planning`)).toMatchObject({ route: "/c/sc-sete/planning" });
    expect(resolveDestination(`${W}/public/sc-sete/compte`)).toMatchObject({ route: "/profil" });
    expect(resolveDestination(`${W}/public/sc-sete`)).toMatchObject({ route: "/c/sc-sete" });
  });

  it("espace club par compte : équivalent mobile si il existe, sinon web assumé", () => {
    expect(resolveDestination(`${W}/c/sc-sete/matchs/m1`)).toEqual({ kind: "route", clubSlug: "sc-sete", route: "/c/sc-sete/matchs/m1" });
    expect(resolveDestination(`${W}/c/sc-sete/admin/integrations/fbi`)).toMatchObject({ kind: "web-only", url: `${W}/c/sc-sete/admin/integrations/fbi` });
    expect(resolveDestination(`${W}/platform`)).toMatchObject({ kind: "web-only" });
  });

  it("lien personnel (query ou fragment) : échangé, jamais gardé dans la route", () => {
    expect(resolveDestination(`${W}/public/sc-sete/accueil?token=abcdefgh123`)).toEqual({ kind: "bootstrap", clubSlug: "sc-sete", token: "abcdefgh123", then: "/c/sc-sete" });
    const d = resolveDestination(`${W}/public/sc-sete/matchs/m1?token=abcdefgh123#convocation`);
    expect(d).toEqual({ kind: "bootstrap", clubSlug: "sc-sete", token: "abcdefgh123", then: "/c/sc-sete/matchs/m1?section=convocation" });
    expect(resolveDestination(`${W}/public/sc-sete/tables#token=abcdefgh123`)).toMatchObject({ kind: "bootstrap", then: "/c/sc-sete/tables" });
  });

  it("lien de connexion à usage unique", () => {
    const code = "c".repeat(43);
    expect(resolveDestination(`${W}/public/sc-sete/connexion/code/${code}`)).toEqual({ kind: "login-code", clubSlug: "sc-sete", code });
  });

  it("schéma de l'app", () => {
    expect(resolveDestination("ballmanager://public/sc-sete/matchs/m1")).toMatchObject({ kind: "route", route: "/c/sc-sete/matchs/m1" });
  });

  it("domaine étranger, http, URL invalide : rejet", () => {
    expect(resolveDestination("https://evil.example/public/sc-sete/accueil")).toEqual({ kind: "reject", reason: "invalid-domain" });
    expect(resolveDestination("http://www.ball-manager.fr/public/sc-sete/accueil")).toEqual({ kind: "reject", reason: "invalid-domain" });
    expect(resolveDestination("pas une url")).toEqual({ kind: "reject", reason: "malformed" });
    expect(resolveDestination(`${W}/public/x/..%2F..%2Fc/admin`)).toEqual({ kind: "reject", reason: "malformed" });
  });

  it("route inconnue ou slug invalide : repli propre", () => {
    expect(resolveDestination(`${W}/tarifs`)).toEqual({ kind: "home" });
    expect(resolveDestination(`${W}/public/Mauvais_Slug/accueil`)).toEqual({ kind: "home" });
    expect(resolveDestination(`${W}/public/sc-sete/inconnu/42`)).toMatchObject({ route: "/c/sc-sete" });
    expect(resolveDestination(`${W}/public/sc-sete/auth/app?state=x`)).toMatchObject({ route: "/c/sc-sete" });
  });

  it("chemin interne Expo Router : jeton et code passent par des écrans dédiés", () => {
    expect(internalPathFor({ kind: "route", clubSlug: "a", route: "/c/a/planning" })).toBe("/c/a/planning");
    expect(internalPathFor({ kind: "bootstrap", clubSlug: "a", token: "tok12345", then: "/c/a" })).toBe("/lien?club=a&token=tok12345&next=%2Fc%2Fa");
    expect(internalPathFor({ kind: "login-code", clubSlug: "a", code: "c".repeat(20) })).toBe(`/code?club=a&code=${"c".repeat(20)}`);
    expect(internalPathFor({ kind: "reject", reason: "malformed" })).toBeNull();
  });

  it("normalisation et anti-doublon au démarrage", () => {
    expect(normalizePath("/public//x/matchs/")).toBe("/public/x/matchs");
    expect(normalizePath("/public/x/%2e%2e/c")).toBeNull();
    let t = 0;
    const accept = createDeduper(3000, () => t);
    expect(accept("u")).toBe(true);
    t = 500;
    expect(accept("u")).toBe(false);
    t = 4000;
    expect(accept("u")).toBe(true);
  });
});

describe("destination en attente", () => {
  afterEach(() => clearPendingDestination());
  it("consommée une seule fois, pour le bon club", () => {
    setPendingDestination({ clubSlug: "a", route: "/c/a/matchs/m1?section=convocation" });
    expect(takePendingDestination("b")).toBeNull();
    expect(takePendingDestination("a")).toBe("/c/a/matchs/m1?section=convocation");
    expect(takePendingDestination("a")).toBeNull();
  });
  it("jamais une route dangereuse", () => {
    setPendingDestination({ clubSlug: null, route: "//evil.example" });
    expect(peekPendingDestination()).toBeNull();
    setPendingDestination({ clubSlug: null, route: "/c/a/../../x" });
    expect(peekPendingDestination()).toBeNull();
  });
});
