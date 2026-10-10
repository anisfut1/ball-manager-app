import { dayKey, dayRange, formatTime, relativeDay, relativeDayTime, zonedToUtcIso } from "./dates";

const TZ = "Europe/Paris";
const NOW = new Date("2026-10-15T08:00:00Z"); // jeudi 15 octobre 2026

describe("dates au fuseau du club", () => {
  it("heure du gymnase, pas celle du téléphone", () => {
    expect(formatTime("2026-10-17T16:00:00Z", TZ)).toBe("18:00");
    expect(formatTime("2026-10-17T16:00:00Z", "America/New_York")).toBe("12:00");
  });
  it("jour : minuit local, pas UTC", () => {
    expect(dayKey("2026-10-17T22:30:00Z", TZ)).toBe("2026-10-18");
  });
  it("libellés relatifs", () => {
    expect(relativeDay("2026-10-15T17:00:00Z", TZ, NOW)).toBe("Aujourd'hui");
    expect(relativeDay("2026-10-16T17:00:00Z", TZ, NOW)).toBe("Demain");
    expect(relativeDay("2026-10-17T16:00:00Z", TZ, NOW)).toBe("Samedi");
    expect(relativeDayTime("2026-10-16T17:00:00Z", TZ, NOW)).toBe("Demain · 19:00");
    expect(relativeDay("2026-11-28T16:00:00Z", TZ, NOW)).toMatch(/28/);
  });
  it("heure locale → UTC, été comme hiver", () => {
    expect(zonedToUtcIso("2026-10-17", "16:15", TZ)).toBe("2026-10-17T14:15:00.000Z");
    expect(zonedToUtcIso("2026-12-12", "16:15", TZ)).toBe("2026-12-12T15:15:00.000Z");
  });
  it("plage de jours", () => {
    expect(dayRange(TZ, 1, 13, NOW)).toEqual({ from: "2026-10-14", to: "2026-10-28" });
  });
});
