import type { MatchListItem } from "@/api/endpoints/clubSpace";
import { clubSideLabel, competitionLine, groupByDay, matchOutcome, matchSides, matchStatusLabel } from "./match-model";

const base: MatchListItem = {
  id: "m1",
  numero: "123",
  journee: "5",
  matchDatetime: "2026-10-17T18:30:00Z",
  isHome: true,
  teamName: "Seniors F",
  competitionName: "Régionale 2",
  categoryLabel: "SF",
  opponentName: "Montpellier",
  opponentLogoUrl: null,
  venueLabel: "Gymnase",
  scoreHome: null,
  scoreAway: null,
  status: "scheduled",
  emarqueStatus: "pending",
  derogationStatus: null,
} as MatchListItem;
const club = { name: "SC Sète Basket", logoUrl: null };

describe("affichage d'un match (règles du web)", () => {
  it("domicile d'abord, club d'abord si côté inconnu", () => {
    expect(matchSides(base, club).map((s) => s.name)).toEqual(["Seniors F", "Montpellier"]);
    expect(matchSides({ ...base, isHome: false }, club).map((s) => s.name)).toEqual(["Montpellier", "Seniors F"]);
    expect(matchSides({ ...base, isHome: null }, club)[0].isClub).toBe(true);
  });

  it("équipe inconnue : club · catégorie, jamais devinée", () => {
    expect(clubSideLabel({ teamName: null, categoryLabel: "U9" }, club.name)).toBe("SC Sète Basket · U9");
    expect(clubSideLabel({ teamName: null, categoryLabel: null }, club.name)).toBe("SC Sète Basket");
  });

  it("issue pour le club selon le côté", () => {
    expect(matchOutcome({ scoreHome: 70, scoreAway: 60, isHome: true })).toBe("win");
    expect(matchOutcome({ scoreHome: 70, scoreAway: 60, isHome: false })).toBe("loss");
    expect(matchOutcome({ scoreHome: 60, scoreAway: 60, isHome: true })).toBe("draw");
    expect(matchOutcome({ scoreHome: null, scoreAway: 60, isHome: true })).toBeNull();
  });

  it("libellés de statut et de compétition", () => {
    expect(matchStatusLabel("postponed")?.label).toBe("Reporté");
    expect(matchStatusLabel("scheduled")).toBeNull();
    expect(competitionLine(base)).toBe("Journée 5 · Régionale 2");
    expect(competitionLine({ journee: null, competitionName: null, numero: "42" })).toBe("Rencontre n° 42");
  });

  it("regroupe par jour (Europe/Paris), sans date à la fin", () => {
    const groups = groupByDay([{ at: "2026-10-17T18:30:00Z" }, { at: null }, { at: "2026-10-17T08:00:00Z" }], (x) => x.at);
    expect(groups.map((g) => g.items.length)).toEqual([2, 1]);
    expect(groups[0].label).toBe("Samedi 17 octobre");
    expect(groups[1].label).toBe("Date à confirmer");
  });
});
