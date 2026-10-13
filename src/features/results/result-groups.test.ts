// Tests repris tels quels de ball-manager-web (même règle, même attendu).

import type { MatchListItem as MatchListItemDto, PoolStandingsDto } from "@/api/endpoints/clubSpace";
import { buildResultGroups, groupKey } from "./result-groups";

function match(overrides: Partial<MatchListItemDto>): MatchListItemDto {
  return {
    id: "m",
    numero: null,
    journee: null,
    matchDatetime: "2026-09-26T13:00:00Z",
    isHome: true,
    teamName: "U15 M",
    competitionName: "Départementale U15 M",
    categoryLabel: "U15",
    opponentName: "Agde",
    opponentLogoUrl: null,
    venueLabel: null,
    scoreHome: 60,
    scoreAway: 50,
    status: "played",
    emarqueStatus: "imported",
    derogationStatus: null,
    ...overrides,
  };
}

function pool(overrides: Partial<PoolStandingsDto>): PoolStandingsDto {
  return { poolId: "p", poolName: "Poule A", competitionName: "Départementale U15 M", categoryLabel: "U15", teamId: "t", teamName: "U15 M", updatedAt: "2026-10-01T03:00:00Z", rows: [], ...overrides };
}

const NOW = new Date("2026-10-01T12:00:00Z");

describe("buildResultGroups", () => {
  it("regroupe par équipe, du plus récent au plus ancien, avec le bilan V/D", () => {
    const groups = buildResultGroups(
      [
        match({ id: "a", matchDatetime: "2026-09-19T13:00:00Z", scoreHome: 40, scoreAway: 55 }),
        match({ id: "b", matchDatetime: "2026-09-26T13:00:00Z", isHome: false, scoreHome: 40, scoreAway: 55 }),
        match({ id: "c", teamName: "Seniors 1 M", matchDatetime: "2026-09-27T13:00:00Z" }),
      ],
      [],
      "SC Sète",
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(["Seniors 1 M", "U15 M"]);
    const u15 = groups.find((g) => g.label === "U15 M")!;
    expect(u15.results.map((m) => m.id)).toEqual(["b", "a"]);
    expect(u15.record).toEqual({ won: 1, lost: 1, draw: 0 });
  });

  it("ignore les matchs sans score ou à venir, et rattache les classements par équipe", () => {
    const groups = buildResultGroups(
      [match({ id: "x", scoreHome: null, scoreAway: null }), match({ id: "future", matchDatetime: "2026-10-10T13:00:00Z" })],
      [pool({ teamName: "U15 M" }), pool({ poolId: "q", teamName: null, categoryLabel: "U9" })],
      "SC Sète",
      NOW,
    );
    expect(groups.map((g) => [g.label, g.results.length, g.standings.length])).toEqual([
      ["SC Sète · U9", 0, 1],
      ["U15 M", 0, 1],
    ]);
  });

  it("produit une clé d'URL stable sans accents", () => {
    expect(groupKey("SC Sète · U9")).toBe("sc-sete-u9");
  });
});
