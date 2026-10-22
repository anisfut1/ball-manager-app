import { addDays, closureDates, monthGrid, todayIn } from "./dates";

describe("jours du calendrier admin", () => {
  it("grille du mois, lundi en premier", () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(weeks.at(-1)?.[0]).toBe("2026-11-30");
  });

  it("dates lisibles et calculs de jours", () => {
    expect(closureDates("2026-11-07", "2026-11-07")).toBe("samedi 7 novembre");
    expect(closureDates("2026-12-21", "2027-01-03")).toBe("du 21 décembre au 3 janvier");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(todayIn("Europe/Paris", new Date("2026-10-22T23:30:00Z"))).toBe("2026-10-23");
  });
});
