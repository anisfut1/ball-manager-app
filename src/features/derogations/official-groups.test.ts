import type { OfficialDerogation as DerogationListItemDto } from "@/api/endpoints/derogations";
import { changesKnown, derogationVerdict, isRetainedSchedule, supersededBy, describeRequestedChanges, etatTone, groupDerogationsByMatch, hasDerogationDetail, parisSlot, parseFbiDate, requestMatchesOfficial } from "./official-groups";

function derogation(overrides: Partial<DerogationListItemDto>): DerogationListItemDto {
  return {
    id: "d-1",
    numero: "9608",
    etat: "Refusée",
    dateDepot: null,
    dateDerogation: null,
    dateRencontre: null,
    heure: null,
    domicile: null,
    visiteur: null,
    demandeur: null,
    motif: null,
    dateRencontreDemandee: null,
    heureDemandee: null,
    adversaire: null,
    dateReponse: null,
    acceptation: null,
    motifRefus: null,
    checkedAt: "2026-10-07T09:15:00Z",
    actionRequired: false,
    matchId: "m-9608",
    opponentName: "BASKET BALL LUNEL VIEL - 1",
    matchDatetime: "2026-10-17T18:00:00Z",
    categoryLabel: "Seniors",
    teamName: "Seniors M 3",
    scheduleConflict: null,
    ...overrides,
  } as DerogationListItemDto;
}

describe("groupDerogationsByMatch", () => {
  it("regroupe toutes les dérogations d'un même match dans une seule carte (rencontre 9608 : 3 dérogations, 2 refusées)", () => {
    const groups = groupDerogationsByMatch([
      derogation({ id: "a", etat: "Refusée", dateDepot: "01/09/2026" }),
      derogation({ id: "other", matchId: "m-other", numero: "9700" }),
      derogation({ id: "b", etat: "Refusée", dateDepot: "10/09/2026" }),
      derogation({ id: "c", etat: "Acceptée par l'organisme dirigeant", dateDepot: "20/09/2026" }),
    ]);

    expect(groups).toHaveLength(2);
    const group9608 = groups.find((g) => g.key === "match:m-9608")!;
    expect(group9608.derogations.map((d) => d.id)).toEqual(["a", "b", "c"]);
  });

  it("met en tête la dérogation qui attend une réponse du club, et le match concerné en premier", () => {
    const groups = groupDerogationsByMatch([
      derogation({ id: "x", matchId: "m-1", matchDatetime: "2026-10-01T10:00:00Z" }),
      derogation({ id: "old", matchId: "m-2", dateDepot: "20/09/2026", matchDatetime: "2026-12-01T10:00:00Z" }),
      derogation({ id: "pending", matchId: "m-2", etat: "En Cours", actionRequired: true, dateDepot: "01/09/2026", matchDatetime: "2026-12-01T10:00:00Z" }),
    ]);

    expect(groups[0]!.key).toBe("match:m-2");
    expect(groups[0]!.actionRequired).toBe(true);
    expect(groups[0]!.derogations[0]!.id).toBe("pending");
  });

  it("place les dérogations sans date connue après celles datées, sans inventer d'ordre entre elles", () => {
    const groups = groupDerogationsByMatch([derogation({ id: "nodate-1" }), derogation({ id: "dated", dateDepot: "05/09/2026" }), derogation({ id: "nodate-2" })]);
    expect(groups[0]!.derogations.map((d) => d.id)).toEqual(["dated", "nodate-1", "nodate-2"]);
  });
});

describe("etatTone / parseFbiDate", () => {
  it("colore uniquement selon les mots présents dans le libellé", () => {
    expect(etatTone("Refusée")).toBe("danger");
    expect(etatTone("Acceptée par l'organisme dirigeant")).toBe("success");
    expect(etatTone("En Cours")).toBe("warning");
    expect(etatTone("Autre")).toBe("neutral");
    expect(etatTone(null)).toBe("neutral");
  });

  it("lit les dates FBI jj/mm/aaaa, null sinon", () => {
    expect(parseFbiDate("17/10/2026")).toBe(Date.UTC(2026, 9, 17));
    expect(parseFbiDate("—")).toBeNull();
    expect(parseFbiDate(null)).toBeNull();
  });
});

describe("horaire officiel et conclusion (retour du club, 2026-10-07 : rencontre 2, U18 F vs Agde, jouée à 17h30)", () => {
  // Données réelles FBI (fbi_derogation_checks) : une demande 16:30 acceptée, une autre acceptée sans détail récupéré.
  const agde = [
    derogation({ id: "a", matchId: "m-2", etat: "Acceptée par l'organisme dirigeant", dateRencontre: "26/09/2026", heure: "16:30", heureDemandee: "16:30", demandeur: "Domicile", motif: "Organisation journée. Merci", matchDatetime: "2026-09-26T15:30:00Z" }),
    derogation({ id: "b", matchId: "m-2", etat: "Acceptée par l'organisme dirigeant", dateRencontre: "26/09/2026", heure: "17:30", matchDatetime: "2026-09-26T15:30:00Z" }),
  ];

  it("lit l'horaire officiel en heure française", () => {
    expect(parisSlot("2026-09-26T15:30:00Z")).toEqual({ date: "26/09/2026", time: "17:30" });
  });

  it("une demande pour 16:30 ne correspond pas à l'horaire officiel de 17:30 ; une demande sans horaire ne correspond jamais", () => {
    const official = parisSlot("2026-09-26T15:30:00Z");
    expect(requestMatchesOfficial(agde[0]!, official)).toBe(false);
    expect(requestMatchesOfficial(agde[1]!, official)).toBe(false);
    expect(requestMatchesOfficial(derogation({ dateRencontreDemandee: "26/09/2026", heureDemandee: "17:30" }), official)).toBe(true);
  });

  it("signale le détail non récupéré", () => {
    expect(hasDerogationDetail(agde[0]!)).toBe(true);
    expect(hasDerogationDetail(agde[1]!)).toBe(false);
  });

  it("conclut sans rien supposer : action requise > en cours > acceptée à l'horaire actuel > tout refusé > réglé", () => {
    expect(derogationVerdict(groupDerogationsByMatch(agde)[0]!).kind).toBe("settled");
    expect(derogationVerdict(groupDerogationsByMatch([derogation({ etat: "Refusée" }), derogation({ id: "z", etat: "Refusée" })])[0]!).kind).toBe("all_refused");
    expect(derogationVerdict(groupDerogationsByMatch([derogation({ etat: "En Cours" })])[0]!).kind).toBe("pending");
    expect(derogationVerdict(groupDerogationsByMatch([derogation({ etat: "En Cours", actionRequired: true })])[0]!).kind).toBe("action_required");
    expect(
      derogationVerdict(groupDerogationsByMatch([derogation({ etat: "Acceptée par l'organisme dirigeant", heureDemandee: "17:30", matchDatetime: "2026-09-26T15:30:00Z" }), derogation({ id: "r", etat: "Refusée" })])[0]!).kind,
    ).toBe("accepted_current");
  });
});

describe("changements demandés (cases FBI, retour du club 2026-10-08)", () => {
  it("liste uniquement les cases cochées, avec la salle demandée", () => {
    const d = derogation({ modifierDate: false, modifierHoraire: false, modifierSalle: true, salleDemandee: "GYMNASE DE SERIGNAN", inverserRencontre: true, inverserEquipe: false });
    expect(describeRequestedChanges(d)).toEqual(["Salle → GYMNASE DE SERIGNAN", "Inversion de la rencontre"]);
    expect(changesKnown(d)).toBe(true);
  });

  it("ne déduit rien quand les cases n'ont pas été lues", () => {
    const d = derogation({ modifierDate: null, modifierHoraire: null, modifierSalle: null, inverserRencontre: null, inverserEquipe: null });
    expect(describeRequestedChanges(d)).toEqual([]);
    expect(changesKnown(d)).toBe(false);
  });
});

describe("chronologie réelle (retour du club, 2026-10-08, rencontre 2 vs Agde : le 11/09 calée à 16h30, le 21/09 remise à 17h30)", () => {
  const base = { matchId: "m-2", etat: "Acceptée par l'organisme dirigeant", matchDatetime: "2026-09-26T15:30:00Z", modifierDate: false, modifierHoraire: true, modifierSalle: false, inverserRencontre: false, inverserEquipe: false, demandeur: "Domicile" };
  const d1 = derogation({ ...base, id: "d1", dateDepot: "11/09/2026 16:38", heureDemandee: "16:30" });
  const d2 = derogation({ ...base, id: "d2", dateDepot: "21/09/2026 13:49", heureDemandee: "17:30" });

  it("ordonne par date de dépôt, la plus ancienne d'abord", () => {
    expect(groupDerogationsByMatch([d2, d1])[0]!.derogations.map((d) => d.id)).toEqual(["d1", "d2"]);
  });

  it("dit ce qui a changé, jamais un faux « avant »", () => {
    expect(describeRequestedChanges(d1)).toEqual(["Horaire → 16:30"]);
    expect(describeRequestedChanges(d2)).toEqual(["Horaire → 17:30"]);
  });

  it("la plus récente est l'horaire retenu, la première est remplacée le 21/09", () => {
    expect(isRetainedSchedule(d2)).toBe(true);
    expect(isRetainedSchedule(d1)).toBe(false);
    expect(supersededBy(d1, [d1, d2])).toBe("21/09/2026 13:49");
    expect(supersededBy(d2, [d1, d2])).toBeNull();
  });
});

describe("remplacement d'une salle (n°25 vs Sauvian : salle → Lido le 14/09, puis → Maurice Clavel le 18/09)", () => {
  const base = { matchId: "m-25", etat: "Acceptée par l'organisme dirigeant", modifierDate: false, modifierHoraire: false, modifierSalle: true, inverserRencontre: false, inverserEquipe: false };
  it("signale la première salle comme remplacée, jamais un horaire sans rapport", () => {
    const lido = derogation({ ...base, id: "l", dateDepot: "14/09/2026 19:58", salleDemandee: "COMPLEXE SPORTIF DU LIDO - SETE" });
    const horaire = derogation({ ...base, id: "h", modifierSalle: false, modifierHoraire: true, heureDemandee: "17:00", dateDepot: "14/09/2026 20:00" });
    const clavel = derogation({ ...base, id: "c", dateDepot: "18/09/2026 09:37", salleDemandee: "GYMNASE MAURICE CLAVEL - SETE" });
    expect(supersededBy(lido, [lido, horaire, clavel])).toBe("18/09/2026 09:37");
    expect(supersededBy(horaire, [lido, horaire, clavel])).toBeNull();
    expect(supersededBy(clavel, [lido, horaire, clavel])).toBeNull();
  });
});
