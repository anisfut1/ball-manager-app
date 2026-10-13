import { currentOrNextWeekendSaturday, formatWeekendLabel, weekendRange } from "./weekend";

const TZ = "Europe/Paris";

describe("journée = week-end (règles du web)", () => {
  it("samedi du week-end en cours ou du prochain", () => {
    expect(currentOrNextWeekendSaturday(TZ, new Date("2026-10-13T10:00:00Z"))).toBe("2026-10-17"); // mardi
    expect(currentOrNextWeekendSaturday(TZ, new Date("2026-10-17T10:00:00Z"))).toBe("2026-10-17"); // samedi
    expect(currentOrNextWeekendSaturday(TZ, new Date("2026-10-18T21:00:00Z"))).toBe("2026-10-17"); // dimanche
  });

  it("bornes ISO en UTC, y compris au changement d'heure (25 octobre)", () => {
    expect(weekendRange("2026-10-17", TZ)).toEqual({ from: "2026-10-16T22:00:00.000Z", to: "2026-10-18T22:00:00.000Z" });
    expect(weekendRange("2026-10-24", TZ)).toEqual({ from: "2026-10-23T22:00:00.000Z", to: "2026-10-25T23:00:00.000Z" });
  });

  it("libellé du week-end", () => {
    expect(formatWeekendLabel("2026-10-17")).toBe("Week-end du 17 au 18 octobre");
    expect(formatWeekendLabel("2026-10-31")).toBe("Week-end du 31 octobre au 1 novembre");
  });
});
