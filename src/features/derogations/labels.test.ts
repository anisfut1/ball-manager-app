import type { DerogationSummary } from "@/api/endpoints/derogations";
import { zonedToUtcIso as zonedIso } from "@/lib/dates";
import { formatDayLong, formatTime, groupRequests, isArchivedRequest, upcomingWeekendDays } from "./labels";

// Recopié des tests du web (derogation-requests/labels.test.ts).
const TZ = "Europe/Paris";

describe("week-ends proposés (fuseau du club)", () => {
  it("jeudi 1er octobre : samedi 3, dimanche 4, samedi 10, dimanche 11…", () => {
    const days = upcomingWeekendDays(new Date("2026-10-01T10:00:00Z"), TZ, 2);
    expect(days.map((d) => `${d.weekday} ${d.day} ${d.month}`)).toEqual(["SAM 3 OCT", "DIM 4 OCT", "SAM 10 OCT", "DIM 11 OCT"]);
    expect(days[3]!.date).toBe("2026-10-11");
  });

  it("samedi soir 23h30 UTC = dimanche à Paris : le dimanche du jour n'est plus proposé", () => {
    const days = upcomingWeekendDays(new Date("2026-10-03T22:30:00Z"), TZ, 1);
    expect(days.map((d) => d.date)).toEqual(["2026-10-10", "2026-10-11"]);
  });
});

describe("heures murales du club", () => {
  it("dimanche 11 octobre 15:00 Paris (heure d'été) = 13:00 UTC ; 7 novembre = 14:00 UTC", () => {
    expect(zonedIso("2026-10-11", "15:00", TZ)).toBe("2026-10-11T13:00:00.000Z");
    expect(zonedIso("2026-11-07", "15:00", TZ)).toBe("2026-11-07T14:00:00.000Z");
    expect(formatDayLong("2026-10-11T13:00:00.000Z", TZ)).toBe("dimanche 11 octobre");
    expect(formatTime("2026-10-11T13:00:00.000Z", TZ)).toBe("15:00");
  });
});

describe("sections", () => {
  const r = (id: string, status: DerogationSummary["status"]) => ({ id, status }) as DerogationSummary;
  it("coordinateur : « À traiter » d'abord ; coach : « À revoir » d'abord ; sections vides masquées", () => {
    const list = [r("a", "REQUESTED"), r("b", "NEEDS_CHANGE"), r("c", "COMPLETED")];
    expect(groupRequests(list, true).map((s) => s.title)).toEqual(["À traiter", "En attente du coach", "Terminées"]);
    expect(groupRequests(list, false).map((s) => s.title)).toEqual(["À revoir", "En attente", "Terminées"]);
  });
});

describe("archives", () => {
  const now = new Date("2026-10-13T10:00:00Z");
  it("terminée ou annulée : archivée ; match passé : archivée ; à venir : active", () => {
    expect(isArchivedRequest({ status: "COMPLETED", originalScheduledAt: null, requestedStartAt: "2026-12-01T10:00:00Z" }, now)).toBe(true);
    expect(isArchivedRequest({ status: "REQUESTED", originalScheduledAt: "2026-10-01T10:00:00Z", requestedStartAt: "2026-10-05T10:00:00Z" }, now)).toBe(true);
    expect(isArchivedRequest({ status: "REQUESTED", originalScheduledAt: "2026-10-01T10:00:00Z", requestedStartAt: "2026-10-20T10:00:00Z" }, now)).toBe(false);
  });
});
