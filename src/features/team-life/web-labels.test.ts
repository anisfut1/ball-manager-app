import { attendanceLabel, attendanceText, collectTeams, countsSummary, mondayOf, relativeDay, seasonEndKey, seriesLabel, shortDateTime, timeOf } from "./web-labels";

// Recopié des tests du web (labels.test.ts, TeamPageView.test.tsx, usage-improvements.test.tsx).
describe("libellés Vie d'équipe (identiques au web)", () => {
  it("heure murale du club, été comme hiver", () => {
    expect(timeOf("2026-10-13T17:00:00.000Z", "Europe/Paris")).toBe("19:00");
    expect(timeOf("2026-11-10T18:00:00.000Z", "Europe/Paris")).toBe("19:00");
  });
  it("aujourd'hui / demain dans le fuseau du club", () => {
    const now = new Date("2026-10-13T08:00:00.000Z");
    expect(relativeDay("2026-10-13T17:00:00.000Z", "Europe/Paris", now)).toBe("aujourd'hui");
    expect(relativeDay("2026-10-14T17:00:00.000Z", "Europe/Paris", now)).toBe("demain");
    expect(relativeDay("2026-10-16T17:00:00.000Z", "Europe/Paris", now)).toBe("vendredi 16 oct.");
  });
  it("créneau et fin de saison", () => {
    expect(seriesLabel({ weekday: 2, startTime: "19:00", endTime: "20:30" })).toBe("Mardi 19:00–20:30");
    expect(seasonEndKey("2026-10-09")).toBe("2027-06-30");
    expect(seasonEndKey("2027-03-01")).toBe("2027-06-30");
  });
  it("résumé des réponses sans zéros inutiles", () => {
    expect(countsSummary({ present: 8, absent: 1, uncertain: 0, noResponse: 3 })).toBe("8 présents · 1 absent · 3 sans réponse");
    expect(countsSummary({ present: 0, absent: 0, uncertain: 0, noResponse: 0 })).toBe("Aucun joueur dans l'effectif");
  });
  it("date courte d'un match", () => {
    expect(shortDateTime("2026-10-17T16:00:00.000Z", "Europe/Paris")).toBe("Sam. 17 oct. · 18:00");
    expect(shortDateTime(null, "Europe/Paris")).toBe("Date à confirmer");
  });
  it("libellé d'assiduité", () => {
    expect(attendanceLabel({ absent: 0, late: 0 })).toBe("Toujours là");
    expect(attendanceLabel({ absent: 1, late: 0 })).toBe("1 absence");
    expect(attendanceLabel({ absent: 0, late: 3 })).toBe("3 retards");
    expect(attendanceText(null)).toBe("Présence non relevée");
    expect(attendanceText({ recorded: true, absent: 0, late: 0 })).toBe("Tout le monde présent");
    expect(attendanceText({ recorded: true, absent: 2, late: 1 })).toBe("2 absents · 1 retard");
  });
  it("lundi de la semaine", () => {
    expect(mondayOf("2026-10-13")).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(mondayOf("2026-10-12")).toBe("2026-10-12");
  });
  it("équipes de l'appareil : coachées d'abord, prénoms concernés", () => {
    const teams = collectTeams([
      { licencie: { firstName: "Claire" }, teams: [{ id: "sf", name: "Seniors F", relation: "PLAYER" }, { id: "sf", name: "Seniors F", relation: "COACH" }] },
      { licencie: { firstName: "Hugo" }, teams: [{ id: "s1m", name: "Seniors 1 M", relation: "PLAYER" }] },
    ]);
    expect(teams).toEqual([
      { id: "sf", name: "Seniors F", coach: true, who: ["Claire"] },
      { id: "s1m", name: "Seniors 1 M", coach: false, who: ["Hugo"] },
    ]);
  });
});
