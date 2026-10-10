import type { ActionCenterAction, ActionCenterDto, AvailabilityValue, TrainingResponseValue } from "@/api/endpoints/teamLife";

/** Clé stable d'une action (liste React, mise à jour optimiste). */
export function actionKey(action: ActionCenterAction): string {
  switch (action.type) {
    case "TRAINING_RESPONSE":
      return `training:${action.training.id}:${action.licencieId}`;
    case "COACH_TRAINING_SUMMARY":
      return `coach-training:${action.training.id}`;
    case "MATCH_AVAILABILITY":
      return `availability:${action.match.id}:${action.licencieId}`;
    case "CONVOCATION_RESPONSE":
      return `convocation:${action.match.id}:${action.licencieId}`;
    case "COACH_MATCH":
      return `coach-match:${action.match.id}`;
    case "LAUNDRY_DUTY":
      return `laundry:${action.match.id}:${action.licencieId}`;
  }
}

export type OptimisticAnswer =
  | { kind: "training"; occurrenceId: string; licencieId: string; response: TrainingResponseValue }
  | { kind: "availability"; matchId: string; licencieId: string; response: AvailabilityValue }
  | { kind: "convocation"; matchId: string; licencieId: string; response: "CONFIRMED" | "DECLINED" }
  | { kind: "laundry-seen"; matchId: string; licencieId: string; at: string };

/**
 * Applique une réponse au cache de l'Action Center AVANT la réponse du
 * serveur (retour en arrière par l'appelant en cas d'échec — jamais de
 * faux succès). Fonction pure.
 */
export function applyAnswer(dto: ActionCenterDto, answer: OptimisticAnswer): ActionCenterDto {
  return {
    ...dto,
    actions: dto.actions.map((a) => {
      if (answer.kind === "training" && a.type === "TRAINING_RESPONSE" && a.training.id === answer.occurrenceId && a.licencieId === answer.licencieId) return { ...a, currentResponse: answer.response };
      if (answer.kind === "availability" && a.type === "MATCH_AVAILABILITY" && a.match.id === answer.matchId && a.licencieId === answer.licencieId) return { ...a, currentResponse: answer.response };
      if (answer.kind === "convocation" && a.type === "CONVOCATION_RESPONSE" && a.match.id === answer.matchId && a.licencieId === answer.licencieId) return { ...a, currentResponse: answer.response };
      if (answer.kind === "laundry-seen" && a.type === "LAUNDRY_DUTY" && a.match.id === answer.matchId && a.licencieId === answer.licencieId) return { ...a, seenAt: answer.at };
      return a;
    }),
  };
}

/** Une action attend-elle encore une réponse ? (liseré « à faire ») */
export function isPending(action: ActionCenterAction): boolean {
  switch (action.type) {
    case "TRAINING_RESPONSE":
    case "MATCH_AVAILABILITY":
      return action.currentResponse === null;
    case "CONVOCATION_RESPONSE":
      return action.currentResponse === "PENDING" && !action.matchClosed;
    case "LAUNDRY_DUTY":
      return action.seenAt === null;
    case "COACH_MATCH":
      return action.stage !== "CONVOCATION_SENT" || (action.convocationCounts?.pending ?? 0) > 0 || !action.laundryAssigned;
    case "COACH_TRAINING_SUMMARY":
      return false;
  }
}

/** Ordre de la Home : ce qui attend une réponse d'abord (convocation > dispo > entraînement > maillots), puis le reste. */
const WEIGHT: Record<ActionCenterAction["type"], number> = { CONVOCATION_RESPONSE: 0, MATCH_AVAILABILITY: 1, TRAINING_RESPONSE: 2, LAUNDRY_DUTY: 3, COACH_MATCH: 4, COACH_TRAINING_SUMMARY: 5 };

export function sortActions(actions: readonly ActionCenterAction[]): ActionCenterAction[] {
  return [...actions].sort((a, b) => Number(isPending(b)) - Number(isPending(a)) || WEIGHT[a.type] - WEIGHT[b.type]);
}

/** « LINA · U15F » : à qui s'adresse l'action (plusieurs enfants sur l'appareil). */
export function personLabel(firstName: string, teamName: string | null | undefined): string {
  return teamName ? `${firstName} · ${teamName}` : firstName;
}
