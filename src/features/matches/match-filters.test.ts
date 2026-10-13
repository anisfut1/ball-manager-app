// Tests repris tels quels de ball-manager-web.

import { applyMatchFilters, buildFilterHref, groupMatchesByWeekend, parseMatchFilters, weekendOptions } from "./match-filters";
import type { MatchListItem as MatchListItemDto } from "@/api/endpoints/clubSpace";

function match(overrides: Partial<MatchListItemDto>): MatchListItemDto {
  return {
    id: "m",
    numero: null,
    journee: null,
    matchDatetime: null,
    isHome: true,
    teamName: "U15",
    competitionName: null,
    categoryLabel: null,
    opponentName: "Agde",
    opponentLogoUrl: null,
    venueLabel: null,
    scoreHome: null,
    scoreAway: null,
    status: "scheduled",
    emarqueStatus: "pending",
    derogationStatus: null,
    ...overrides,
  };
}

describe("match filters", () => {
  it("parses defaults and ignores unknown values", () => {
    expect(parseMatchFilters({})).toEqual({ when: "weekend", side: "all", team: null, weekend: null });
    expect(parseMatchFilters({ when: "past", side: "away", team: "t1" })).toEqual({ when: "past", side: "away", team: "t1", weekend: null });
    expect(parseMatchFilters({ when: "nope", side: ["home"] })).toEqual({ when: "weekend", side: "all", team: null, weekend: null });
  });

  it("builds hrefs omitting default values", () => {
    const current = { when: "weekend", side: "all", team: null, weekend: null } as const;
    expect(buildFilterHref("/c/x/matchs", current, {})).toBe("/c/x/matchs");
    expect(buildFilterHref("/c/x/matchs", current, { when: "upcoming", team: "t1" })).toBe("/c/x/matchs?when=upcoming&team=t1");
  });

  it("filters by side, team and period, sorted", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const all = [
      match({ id: "a", matchDatetime: "2026-10-10T18:00:00Z", isHome: false }),
      match({ id: "b", matchDatetime: "2026-10-05T18:00:00Z", teamName: "U17" }),
      match({ id: "c", matchDatetime: "2026-09-20T18:00:00Z" }),
    ];
    const teams = [{ id: "t15", name: "U15", category: null, sexe: null, numeroEquipe: null, active: true }];
    expect(applyMatchFilters(all, teams, { when: "upcoming", side: "all", team: null, weekend: null }, now).map((m) => m.id)).toEqual(["b", "a"]);
    expect(applyMatchFilters(all, teams, { when: "upcoming", side: "home", team: null, weekend: null }, now).map((m) => m.id)).toEqual(["b"]);
    expect(applyMatchFilters(all, teams, { when: "upcoming", side: "all", team: "t15", weekend: null }, now).map((m) => m.id)).toEqual(["a"]);
    expect(applyMatchFilters(all, teams, { when: "past", side: "all", team: null, weekend: null }, now).map((m) => m.id)).toEqual(["c"]);
  });

  it("groups by weekend (Europe/Paris), weekday matches join the next weekend, order kept", () => {
    const groups = groupMatchesByWeekend([
      match({ id: "sat", matchDatetime: "2026-10-03T12:00:00Z" }),
      match({ id: "sun-late", matchDatetime: "2026-10-04T21:30:00Z" }), // 04/10 à 23h30 heure de Paris → dimanche
      match({ id: "wed", matchDatetime: "2026-10-07T17:00:00Z" }),
      match({ id: "nodate", matchDatetime: null }),
    ]);
    expect(groups.map((g) => [g.saturday, g.matches.map((m) => m.id)])).toEqual([
      ["2026-10-03", ["sat", "sun-late"]],
      ["2026-10-10", ["wed"]],
      ["undated", ["nodate"]],
    ]);
    expect(groups[0]!.label).toBe("Week-end du 3 au 4 octobre");
  });

  it("selects a journée (weekend param), including weekday matches of that week", () => {
    expect(parseMatchFilters({ weekend: "2026-10-10" }).weekend).toBe("2026-10-10");
    expect(parseMatchFilters({ weekend: "2026-10-09" }).weekend).toBeNull(); // pas un samedi
    expect(parseMatchFilters({ when: "upcoming", weekend: "2026-10-10" }).weekend).toBeNull();
    const all = [
      match({ id: "a", matchDatetime: "2026-10-03T12:00:00Z" }),
      match({ id: "b", matchDatetime: "2026-10-07T17:00:00Z" }),
      match({ id: "c", matchDatetime: "2026-10-11T09:00:00Z" }),
    ];
    const f = { when: "weekend", side: "all", team: null, weekend: "2026-10-10" } as const;
    expect(applyMatchFilters(all, [], f).map((m) => m.id)).toEqual(["b", "c"]);
    expect(buildFilterHref("/x", f, {})).toBe("/x?weekend=2026-10-10");
    expect(buildFilterHref("/x", f, { when: "upcoming" })).toBe("/x?when=upcoming");
    const now = new Date("2026-10-01T10:00:00Z");
    expect(weekendOptions(all, [], f, now).map((o) => [o.saturday, o.count])).toEqual([
      ["2026-10-03", 1],
      ["2026-10-10", 2],
    ]);
  });
});
