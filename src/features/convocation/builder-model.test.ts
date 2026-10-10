import type { MatchTeamLifeDto } from "@/api/endpoints/teamLife";
import { initialDraft, meetingPresets, toDraftBody, toggle, validate } from "./builder-model";

const TZ = "Europe/Paris";
const lic = (id: string) => ({ id, firstName: id, lastName: "Exemple", photoUrl: null });
function data(isHome: boolean, draft: Partial<NonNullable<MatchTeamLifeDto["convocation"]>["draft"]> | null = null): MatchTeamLifeDto {
  return {
    match: { id: "m1", team: { id: "t", name: "U15F" }, startsAt: "2026-10-17T16:00:00Z", isHome, opponent: "Agde", venueName: isHome ? "Gymnase du club" : "Salle d'Agde", venueAddress: null, status: "scheduled" },
    canManage: true,
    matchClosed: false,
    availability: { openedAt: "2026-10-10T10:00:00Z", remindedAt: null, counts: { available: 2, unavailable: 1, uncertain: 0, noResponse: 0, total: 3 }, roster: [{ licencie: lic("lina"), response: "AVAILABLE", respondedAt: null }, { licencie: lic("emma"), response: "AVAILABLE", respondedAt: null }, { licencie: lic("zoe"), response: "UNAVAILABLE", respondedAt: null }] },
    laundry: { assignee: null },
    convocation: draft ? { id: "c1", revision: 0, sentAt: null, draft: { licencieIds: [], meetingAt: null, meetingPoint: null, meetingVenueId: null, coachMessage: null, ...draft }, sent: null, hasUnsentChanges: false, remindedAt: null, matchChanges: [], counts: { convoked: 0, confirmed: 0, declined: 0, pending: 0 }, recipients: [] } : null,
  };
}

describe("assistant de convocation", () => {
  it("présélection : les disponibles ; lieu de RDV = gymnase à domicile", () => {
    const d = initialDraft(data(true), TZ);
    expect(d.licencieIds).toEqual(["lina", "emma"]);
    expect(d.meetingPoint).toBe("Gymnase du club");
  });
  it("brouillon existant prioritaire (heure au fuseau du club)", () => {
    const d = initialDraft(data(true, { licencieIds: ["zoe"], meetingAt: "2026-10-17T14:15:00Z", coachMessage: "Gourde !" }), TZ);
    expect(d).toMatchObject({ licencieIds: ["zoe"], meetingTime: "16:15", coachMessage: "Gourde !" });
  });
  it("extérieur : lieu du RDV obligatoire et distinct (jamais pré-rempli avec la salle adverse)", () => {
    const away = data(false);
    const d = initialDraft(away, TZ);
    expect(d.meetingPoint).toBe("");
    expect(validate({ ...d, meetingTime: "16:15" }, away)).toEqual(["Match à l'extérieur : indique le lieu du rendez-vous (il n'est pas le gymnase du match)."]);
    expect(validate({ ...d, meetingTime: "16:15", meetingPoint: "Parking Maurice Clavel" }, away)).toEqual([]);
  });
  it("heure invalide, sélection vide", () => {
    expect(validate({ licencieIds: [], meetingTime: "25:00", meetingPoint: "x", coachMessage: "" }, data(true))).toHaveLength(2);
  });
  it("heures proposées avant le match, au fuseau du club", () => {
    expect(meetingPresets("2026-10-17T16:00:00Z", TZ).map((p) => p.time)).toEqual(["16:30", "16:45", "17:00", "17:15"]);
    expect(meetingPresets("2026-10-17T16:00:00Z", TZ)[0]!.label).toBe("1 h 30 avant");
  });
  it("corps du brouillon : heure locale → UTC, champs vides → null", () => {
    expect(toDraftBody({ licencieIds: ["lina"], meetingTime: "16:15", meetingPoint: "  ", coachMessage: "" }, data(true), TZ)).toEqual({ licencieIds: ["lina"], meetingAt: "2026-10-17T14:15:00.000Z", meetingPoint: null, coachMessage: null });
    expect(toggle(["a"], "a")).toEqual([]);
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
  });
});
