import { authGuard } from "./auth-guard";
import { destinationAfterLogin } from "./after-login";
import { internalPathFor, resolveDestination } from "@/linking/resolveDestination";
import { clearPendingDestination, mergeLinkDestination, peekPendingDestination, setPendingDestination } from "@/linking/pendingDestination";

const W = "https://www.ball-manager.fr";
const SIGNED_OUT = { signedIn: false, status: "UNAUTHENTICATED" as const, params: {} };
const SIGNED_IN = { signedIn: true, status: "AUTHENTICATED" as const, params: {} };

/** Ce que fait l'app d'un lien entrant : résolveur → chemin interne Expo Router. */
const openLink = (url: string) => internalPathFor(resolveDestination(url));

afterEach(() => clearPendingDestination());

describe("lien profond Résultats / Matchs — résolution", () => {
  it("/public/{slug}/resultats → écran Résultats de CE club", () => {
    expect(resolveDestination(`${W}/public/club-alpha/resultats`)).toEqual({ kind: "route", clubSlug: "club-alpha", route: "/c/club-alpha/resultats" });
  });

  it("/public/{slug}/matchs → écran Matchs de CE club", () => {
    expect(resolveDestination(`${W}/public/club-alpha/matchs`)).toEqual({ kind: "route", clubSlug: "club-alpha", route: "/c/club-alpha/matchs" });
  });

  it("avec un lien personnel (#token) : échangé d'abord, puis Résultats / Matchs", () => {
    expect(resolveDestination(`${W}/public/club-alpha/resultats#token=abcdefgh123`)).toMatchObject({ kind: "bootstrap", clubSlug: "club-alpha", then: "/c/club-alpha/resultats" });
    expect(resolveDestination(`${W}/public/club-alpha/matchs?token=abcdefgh123`)).toMatchObject({ kind: "bootstrap", clubSlug: "club-alpha", then: "/c/club-alpha/matchs" });
  });

  it("le détail d'un match garde son écran (non-régression)", () => {
    expect(openLink(`${W}/public/club-alpha/matchs/m1`)).toBe("/c/club-alpha/matchs/m1");
    expect(openLink(`${W}/public/club-alpha/resultats/m1`)).toBe("/c/club-alpha/matchs/m1");
  });

  it("chemin inconnu : comportement actuel figé (accueil du club)", () => {
    expect(openLink(`${W}/public/club-alpha/inconnu`)).toBe("/c/club-alpha");
  });

  it("slug invalide : comportement actuel figé (accueil de l'app, aucune exception)", () => {
    expect(() => openLink(`${W}/public/Club_Inconnu!/resultats`)).not.toThrow();
    expect(openLink(`${W}/public/Club_Inconnu!/resultats`)).toBe("/");
  });

  it("slug valide mais jamais connecté à l'app : la route reste celle du club demandé (la porte « Accès réservé » décide)", () => {
    expect(openLink(`${W}/public/club-inconnu/resultats`)).toBe("/c/club-inconnu/resultats");
  });
});

describe("lien profond — de l'identification à la destination", () => {
  it("sans session pour le club : mise de côté puis identification de CE club", () => {
    const decision = authGuard({ ...SIGNED_OUT, pathname: openLink(`${W}/public/club-alpha/resultats`)! });
    expect(decision).toEqual({ redirect: "/connexion/club-alpha", pending: { clubSlug: "club-alpha", route: "/c/club-alpha/resultats" } });
  });

  it("Matchs : même chose", () => {
    const decision = authGuard({ ...SIGNED_OUT, pathname: openLink(`${W}/public/club-alpha/matchs`)! });
    expect(decision).toEqual({ redirect: "/connexion/club-alpha", pending: { clubSlug: "club-alpha", route: "/c/club-alpha/matchs" } });
  });

  it("après identification par le lien reçu par email : Résultats, pas la page d'atterrissage du lien", () => {
    const decision = authGuard({ ...SIGNED_OUT, pathname: openLink(`${W}/public/club-alpha/resultats`)! });
    setPendingDestination(decision!.pending);
    // L'email ramène sur la page par défaut du back (Tables) : `/lien` retient la destination.
    const landing = { clubSlug: "club-alpha", route: "/c/club-alpha/tables" };
    setPendingDestination(mergeLinkDestination(peekPendingDestination(), landing));
    expect(destinationAfterLogin("club-alpha", null)).toBe("/c/club-alpha/resultats");
  });

  it("après identification par le lien reçu par email : Matchs", () => {
    const decision = authGuard({ ...SIGNED_OUT, pathname: openLink(`${W}/public/club-alpha/matchs`)! });
    setPendingDestination(decision!.pending);
    setPendingDestination(mergeLinkDestination(peekPendingDestination(), { clubSlug: "club-alpha", route: "/c/club-alpha" }));
    expect(destinationAfterLogin("club-alpha", null)).toBe("/c/club-alpha/matchs");
  });

  it("un lien précis (convocation) ouvert ensuite l'emporte sur une destination restée en attente", () => {
    setPendingDestination({ clubSlug: "club-alpha", route: "/c/club-alpha/resultats" });
    const specific = { clubSlug: "club-alpha", route: "/c/club-alpha/matchs/m1?section=convocation" };
    expect(mergeLinkDestination(peekPendingDestination(), specific)).toEqual(specific);
  });

  it("destination en attente d'un AUTRE club : la page du lien est retenue", () => {
    const other = { clubSlug: "club-beta", route: "/c/club-beta/resultats" };
    const landing = { clubSlug: "club-alpha", route: "/c/club-alpha/tables" };
    expect(mergeLinkDestination(other, landing)).toEqual(landing);
  });

  it("rien en attente : la page du lien est retenue (comportement actuel)", () => {
    const landing = { clubSlug: "club-alpha", route: "/c/club-alpha/tables" };
    expect(mergeLinkDestination(null, landing)).toEqual(landing);
    expect(mergeLinkDestination(null, null)).toBeNull();
  });

  it("club déjà identifié : le garde laisse passer, l'écran demandé s'ouvre directement", () => {
    expect(authGuard({ ...SIGNED_IN, pathname: openLink(`${W}/public/club-alpha/resultats`)! })).toBeNull();
    expect(openLink(`${W}/public/club-alpha/resultats`)).toBe("/c/club-alpha/resultats");
    expect(peekPendingDestination()).toBeNull();
  });
});
