import { destinationAfterLogin } from "@/navigation/after-login";
import { clearPendingDestination, mergeLinkDestination, PENDING_DESTINATION_TTL_MS, peekPendingDestination, setPendingDestination, takePendingDestination } from "./pendingDestination";

const T0 = new Date("2026-10-19T10:00:00Z").getTime();
const MIN = 60_000;
const RESULTS = { clubSlug: "club-alpha", route: "/c/club-alpha/resultats" };

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
});
afterEach(() => {
  clearPendingDestination();
  jest.useRealTimers();
});

describe("destination en attente — durée de vie", () => {
  it("expire 30 minutes après sa création (constante nommée)", () => {
    expect(PENDING_DESTINATION_TTL_MS).toBe(30 * MIN);
  });

  it("identification à T + 29 min : la destination est utilisée", () => {
    setPendingDestination(RESULTS);
    jest.setSystemTime(T0 + 29 * MIN);
    expect(destinationAfterLogin("club-alpha", null)).toBe("/c/club-alpha/resultats");
  });

  it("identification à T + 31 min : destination ignorée, comportement par défaut", () => {
    setPendingDestination(RESULTS);
    jest.setSystemTime(T0 + 31 * MIN);
    expect(destinationAfterLogin("club-alpha", null)).toBe("/c/club-alpha");
    expect(peekPendingDestination()).toBeNull();
  });

  it("une destination expirée n'est pas retenue contre un lien générique du même club", () => {
    setPendingDestination(RESULTS);
    jest.setSystemTime(T0 + 31 * MIN);
    const landing = { clubSlug: "club-alpha", route: "/c/club-alpha/tables" };
    expect(mergeLinkDestination(peekPendingDestination(), landing)).toEqual(landing);
  });

  it("réécrire la même destination ne prolonge pas sa durée de vie", () => {
    setPendingDestination(RESULTS);
    jest.setSystemTime(T0 + 20 * MIN);
    setPendingDestination({ ...RESULTS });
    jest.setSystemTime(T0 + 31 * MIN);
    expect(takePendingDestination("club-alpha")).toBeNull();
  });
});

describe("destination en attente — consommation", () => {
  it("utilisée une fois : elle n'existe plus", () => {
    setPendingDestination(RESULTS);
    expect(destinationAfterLogin("club-alpha", null)).toBe("/c/club-alpha/resultats");
    expect(peekPendingDestination()).toBeNull();
  });

  it("après consommation, un lien générique du même club suit son comportement normal", () => {
    setPendingDestination(RESULTS);
    destinationAfterLogin("club-alpha", null);
    const landing = { clubSlug: "club-alpha", route: "/c/club-alpha/tables" };
    expect(mergeLinkDestination(peekPendingDestination(), landing)).toEqual(landing);
    expect(destinationAfterLogin("club-alpha", null)).toBe("/c/club-alpha");
  });

  it("une destination d'un AUTRE club ne bloque pas celle-ci : elle la remplace, avec sa propre durée de vie", () => {
    setPendingDestination(RESULTS);
    jest.setSystemTime(T0 + 25 * MIN);
    const beta = { clubSlug: "club-beta", route: "/c/club-beta/matchs" };
    setPendingDestination(mergeLinkDestination(peekPendingDestination(), beta));
    expect(peekPendingDestination()).toEqual(beta);
    jest.setSystemTime(T0 + 50 * MIN);
    expect(takePendingDestination("club-beta")).toBe("/c/club-beta/matchs");
  });

  it("un lien vers une ressource précise l'emporte toujours (non-régression)", () => {
    setPendingDestination(RESULTS);
    const match = { clubSlug: "club-alpha", route: "/c/club-alpha/matchs/m1?section=convocation" };
    expect(mergeLinkDestination(peekPendingDestination(), match)).toEqual(match);
  });

  it("lue pour un autre club : elle reste en attente pour le sien", () => {
    setPendingDestination(RESULTS);
    expect(takePendingDestination("club-beta")).toBeNull();
    expect(takePendingDestination("club-alpha")).toBe("/c/club-alpha/resultats");
  });
});
