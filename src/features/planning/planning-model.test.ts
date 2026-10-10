import type { PlanningEvent } from "@/api/endpoints/teamLife";
import { firstUpcomingIndex, groupByDay } from "./planning-model";

const ev = (kind: "MATCH" | "TRAINING", id: string, startsAt: string): PlanningEvent => ({ kind, id, team: { id: "t", name: "U15F" }, startsAt, endsAt: null, title: id, isHome: true, location: null, status: "scheduled" });

describe("planning", () => {
  const events = [ev("MATCH", "m1", "2026-10-17T16:00:00Z"), ev("TRAINING", "o2", "2026-10-15T17:00:00Z"), ev("TRAINING", "o3", "2026-10-17T22:30:00Z")];
  it("regroupe par jour du club et trie (22:30 UTC = dimanche à Paris)", () => {
    const sections = groupByDay(events, "Europe/Paris");
    expect(sections.map((s) => s.key)).toEqual(["2026-10-15", "2026-10-17", "2026-10-18"]);
    expect(sections[0]!.title).toMatch(/^Jeudi 15 octobre/);
  });
  it("filtre matchs / entraînements", () => {
    expect(groupByDay(events, "Europe/Paris", "MATCH").flatMap((s) => s.data.map((e) => e.id))).toEqual(["m1"]);
    expect(groupByDay(events, "Europe/Paris", "TRAINING")).toHaveLength(2);
  });
  it("défilement initial sur aujourd'hui ou après", () => {
    const sections = groupByDay(events, "Europe/Paris");
    expect(firstUpcomingIndex(sections, "2026-10-16")).toBe(1);
    expect(firstUpcomingIndex(sections, "2027-01-01")).toBe(2);
  });
});
