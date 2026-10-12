import { activeClub, activePerson, EMPTY_STATE, withActiveClub, withActivePerson, withClub, withoutClub, type ClubSession } from "./session-model";

const session = (clubSlug: string, people: string[]): ClubSession => ({
  clubSlug,
  clubName: clubSlug.toUpperCase(),
  accentColor: null,
  timezone: "Europe/Paris",
  secret: `bmd_${"a".repeat(24)}`,
  people: people.map((id) => ({ licencieId: id, firstName: id, lastName: "X", teamId: null })),
  activeLicencieId: people[0] ?? null,
});

describe("multi-club", () => {
  const both = withClub(withClub(EMPTY_STATE, session("club-a", ["lina"])), session("club-b", ["mathis"]));

  it("le dernier club connecté devient actif ; les deux sessions sont conservées", () => {
    expect(activeClub(both)?.clubSlug).toBe("club-b");
    expect(Object.keys(both.clubs).sort()).toEqual(["club-a", "club-b"]);
  });

  it("basculer vers un club membre fonctionne ; vers un club inconnu est ignoré (AccessDenied côté écran)", () => {
    expect(activeClub(withActiveClub(both, "club-a"))?.clubSlug).toBe("club-a");
    expect(withActiveClub(both, "club-z")).toBe(both);
  });

  it("retirer le club actif bascule sur un autre club, puis sur aucun", () => {
    const afterB = withoutClub(both, "club-b");
    expect(activeClub(afterB)?.clubSlug).toBe("club-a");
    expect(activeClub(withoutClub(afterB, "club-a"))).toBeNull();
  });

  it("personne active propre à chaque club ; personne inconnue ignorée", () => {
    const s = withClub(both, session("club-a", ["lina", "mathis"]), false);
    expect(activePerson(s.clubs["club-a"]!)?.licencieId).toBe("lina");
    expect(activePerson(withActivePerson(s, "club-a", "mathis").clubs["club-a"]!)?.licencieId).toBe("mathis");
    expect(withActivePerson(s, "club-a", "inconnu")).toBe(s);
    expect(activeClub(s)?.clubSlug).toBe("club-b");
  });
});
