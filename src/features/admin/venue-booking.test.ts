import type { MatchListItemDto } from "@/api/endpoints/admin";
import { bookingTime, buildBookingGrid, compareTeams, parseBookingMonth, shiftMonth, shortVenue } from "./venue-booking";

function match(over: Partial<MatchListItemDto>): MatchListItemDto {
  return {
    id: Math.random().toString(36).slice(2),
    numero: "1",
    journee: null,
    matchDatetime: "2026-11-07T10:00:00.000Z",
    isHome: true,
    teamName: "U11-2",
    competitionName: null,
    categoryLabel: null,
    opponentName: "Agde",
    opponentLogoUrl: null,
    venueLabel: "GYMNASE MAURICE CLAVEL - SETE",
    scoreHome: null,
    scoreAway: null,
    status: "scheduled",
    emarqueStatus: "none",
    derogationStatus: null,
    ...over,
  };
}

describe("planning « Réservation salle »", () => {
  it("une ligne par samedi/dimanche du mois, l'heure du club dans la case de l'équipe", () => {
    const grid = buildBookingGrid({
      matches: [
        match({ teamName: "U11-2", matchDatetime: "2026-11-07T10:00:00.000Z" }),
        match({ teamName: "Seniors Filles", matchDatetime: "2026-11-07T20:00:00.000Z" }),
        match({ teamName: "U15F", matchDatetime: "2026-11-07T14:00:00.000Z", venueLabel: "COMPLEXE SPORTIF DU LIDO - SETE" }),
        match({ teamName: "U13", matchDatetime: "2026-11-21T12:00:00.000Z", isHome: false }),
        match({ teamName: "U13", matchDatetime: "2026-12-05T12:00:00.000Z" }),
      ],
      teams: ["Séniors", "U9"],
      year: 2026,
      month: 11,
      timeZone: "Europe/Paris",
      homeOnly: true,
    });
    expect(grid.monthLabel).toBe("Novembre 2026");
    expect(grid.days.map((d) => d.label)).toEqual(["Dimanche 1", "Samedi 7", "Dimanche 8", "Samedi 14", "Dimanche 15", "Samedi 21", "Dimanche 22", "Samedi 28", "Dimanche 29"]);
    expect(grid.days[1].startsWeek).toBe(true);
    expect(grid.days[2].startsWeek).toBe(false);
    const samedi7 = grid.days[1].cells;
    expect(samedi7["U11-2"][0].time).toBe("11h");
    expect(samedi7["Seniors Filles"][0].time).toBe("21h");
    expect(samedi7["U15F"][0]).toMatchObject({ time: "15h", venue: "Lido" });
    expect(samedi7["U11-2"][0].venue).toBeNull();
    expect(grid.days[5].cells["U13"]).toBeUndefined();
    expect(grid.matchCount).toBe(3);
    expect(grid.teams).toEqual(["U9", "U11-2", "U15F", "Séniors", "Seniors Filles"]);
  });

  it("« Tous les matchs » : l'extérieur apparaît, marqué comme tel", () => {
    const grid = buildBookingGrid({ matches: [match({ teamName: "U13", matchDatetime: "2026-11-21T12:00:00.000Z", isHome: false })], teams: [], year: 2026, month: 11, timeZone: "Europe/Paris", homeOnly: false });
    expect(grid.days.find((d) => d.label === "Samedi 21")?.cells["U13"][0]).toMatchObject({ time: "13h", venue: "Extérieur", isHome: false });
  });

  it("3x3 : ni match ni colonne pour l'équipe engagée au nom du club", () => {
    const grid = buildBookingGrid({
      matches: [match({ teamName: "SPORT CLUB DE SETE BASKET", competitionName: "Départementale 3x3 Féminine" }), match({ teamName: "U13" })],
      teams: ["SPORT CLUB DE SETE BASKET", "U13"],
      year: 2026,
      month: 11,
      timeZone: "Europe/Paris",
      homeOnly: true,
    });
    expect(grid.teams).toEqual(["U13"]);
    expect(grid.matchCount).toBe(1);
  });

  it("un match en semaine ajoute sa ligne", () => {
    const grid = buildBookingGrid({ matches: [match({ matchDatetime: "2026-11-11T18:30:00.000Z" })], teams: [], year: 2026, month: 11, timeZone: "Europe/Paris", homeOnly: true });
    expect(grid.days.find((d) => d.label === "Mercredi 11")?.cells["U11-2"][0].time).toBe("19h30");
  });

  it("utilitaires", () => {
    expect(bookingTime(15, 30)).toBe("15h30");
    expect(shortVenue("COMPLEXE SPORTIF DU LIDO - SETE")).toBe("Lido");
    expect(shortVenue("GYMNASE MAURICE CLAVEL - SETE")).toBe("Clavel");
    expect(shortVenue("COMPLEXE SPORTIF DU LIDO — 213 RUE DU DAUPHINE")).toBe("Lido");
    expect(shortVenue("GYMNASE MAURICE CLAVEL — 22 rue Maurice Clavel")).toBe("Clavel");
    expect(compareTeams("U9", "U11")).toBeLessThan(0);
    expect(compareTeams("Séniors 2", "U18")).toBeGreaterThan(0);
    expect(parseBookingMonth("2026-13", "Europe/Paris", new Date("2026-10-20T10:00:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(parseBookingMonth("2027-02", "Europe/Paris", new Date())).toEqual({ year: 2027, month: 2 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2027, 1, -1)).toEqual({ year: 2026, month: 12 });
  });
});
