import type { AvailabilityValue, TrainingResponseValue } from "@/api/endpoints/teamLife";
import type { Choice } from "@/components/ui";

/** Libellés neutres (le sexe n'est jamais deviné depuis le prénom) — mêmes mots que le web. */
export const TRAINING_CHOICES: Choice<TrainingResponseValue>[] = [
  { value: "PRESENT", label: "Présent·e", tone: "positive" },
  { value: "ABSENT", label: "Absent·e", tone: "negative" },
  { value: "UNCERTAIN", label: "Incertain·e", tone: "neutral" },
];

export const AVAILABILITY_CHOICES: Choice<AvailabilityValue>[] = [
  { value: "AVAILABLE", label: "Disponible", tone: "positive" },
  { value: "UNAVAILABLE", label: "Indisponible", tone: "negative" },
  { value: "UNCERTAIN", label: "Incertain·e", tone: "neutral" },
];

export const CONVOCATION_CHOICES: Choice<"CONFIRMED" | "DECLINED">[] = [
  { value: "CONFIRMED", label: "Je confirme", tone: "positive" },
  { value: "DECLINED", label: "Je ne peux pas venir", tone: "negative" },
];

/** « U15F vs Agde » / « U15F @ Agde » (extérieur). */
export function matchTitle(team: string, opponent: string | null, isHome: boolean | null): string {
  if (!opponent) return team;
  return isHome === false ? `${team} @ ${opponent}` : `${team} vs ${opponent}`;
}
