import type { ActionCenterAction, ActionCenterDto, TrainingOccurrenceDto } from "@/api/endpoints/teamLife";
import { actionKey, applyAnswer, isPending, personLabel, sortActions } from "./action-center-model";

const team = { id: "t-u15f", name: "U15F" };
const training = (id: string): TrainingOccurrenceDto => ({ id, seriesId: null, team, startsAt: "2026-10-16T17:00:00Z", endsAt: "2026-10-16T18:30:00Z", location: { clubVenueId: null, label: "Gymnase" } as TrainingOccurrenceDto["location"], status: "scheduled", cancelReason: null, isModified: false, counts: null, canManage: false, attendance: null });
const match = { id: "m1", team, startsAt: "2026-10-17T16:00:00Z", isHome: true, opponent: "Agde", venueName: "Gymnase", venueAddress: null, status: "scheduled" };

const trainingAction: ActionCenterAction = { type: "TRAINING_RESPONSE", licencieId: "lina", firstName: "Lina", training: training("o1"), currentResponse: null };
const availability: ActionCenterAction = { type: "MATCH_AVAILABILITY", licencieId: "lina", firstName: "Lina", match, currentResponse: null, reminded: false };
const laundry: ActionCenterAction = { type: "LAUNDRY_DUTY", licencieId: "lina", firstName: "Lina", match, seenAt: null };
const coachSummary: ActionCenterAction = { type: "COACH_TRAINING_SUMMARY", coachLicencieId: "coach", training: training("o2") };

const dto = (actions: ActionCenterAction[]): ActionCenterDto => ({ people: [], canAddRelative: false, invalidTokenIndexes: [], actions, upcoming: [] });

describe("Action Center", () => {
  it("réponse optimiste : seule l'action visée change, l'original reste intact (retour en arrière possible)", () => {
    const before = dto([trainingAction, availability]);
    const after = applyAnswer(before, { kind: "training", occurrenceId: "o1", licencieId: "lina", response: "PRESENT" });
    expect(after.actions[0]).toMatchObject({ currentResponse: "PRESENT" });
    expect(after.actions[1]).toBe(availability);
    expect(before.actions[0]).toMatchObject({ currentResponse: null });
  });

  it("un autre enfant sur la même séance n'est pas modifié", () => {
    const hugo: ActionCenterAction = { ...trainingAction, licencieId: "hugo", firstName: "Hugo" };
    const after = applyAnswer(dto([trainingAction, hugo]), { kind: "training", occurrenceId: "o1", licencieId: "hugo", response: "ABSENT" });
    expect(after.actions.map((a) => (a.type === "TRAINING_RESPONSE" ? a.currentResponse : null))).toEqual([null, "ABSENT"]);
  });

  it("disponibilité et « J'ai vu » (maillots)", () => {
    const after = applyAnswer(applyAnswer(dto([availability, laundry]), { kind: "availability", matchId: "m1", licencieId: "lina", response: "AVAILABLE" }), { kind: "laundry-seen", matchId: "m1", licencieId: "lina", at: "2026-10-15T10:00:00Z" });
    expect(after.actions.every((a) => !isPending(a))).toBe(true);
  });

  it("ordre : ce qui attend une réponse d'abord, convocation en tête", () => {
    const answered: ActionCenterAction = { ...trainingAction, currentResponse: "PRESENT" };
    const sorted = sortActions([coachSummary, answered, laundry, availability]);
    expect(sorted.map((a) => a.type)).toEqual(["MATCH_AVAILABILITY", "LAUNDRY_DUTY", "TRAINING_RESPONSE", "COACH_TRAINING_SUMMARY"]);
  });

  it("clés stables et libellé « LINA · U15F »", () => {
    expect(new Set([trainingAction, availability, laundry, coachSummary].map(actionKey)).size).toBe(4);
    expect(personLabel("Lina", "U15F")).toBe("Lina · U15F");
    expect(personLabel("Lina", null)).toBe("Lina");
  });
});
