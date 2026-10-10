import type { CreateTrainingSeriesDto } from "@/api/endpoints/teamLife";
import { addDaysKey } from "@/lib/dates";

/** Créneau récurrent saisi par le coach (« Mardi 19h–20h30, Maurice Clavel »). */
export interface SlotInput {
  weekday: number; // 0 = dimanche … 6 = samedi (même convention que l'API)
  startTime: string;
  endTime: string;
  location: string;
}

export const WEEKDAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fin de saison sportive : 30 juin suivant (la saison FFBB court de septembre à juin). */
export function seasonEnd(todayKey: string): string {
  const [y, m] = todayKey.split("-").map(Number) as [number, number];
  return `${m >= 7 ? y + 1 : y}-06-30`;
}

/** Nouveau créneau : copie du précédent (même heure, même lieu, jour suivant) pour aller vite. */
export function nextSlot(previous: SlotInput | undefined): SlotInput {
  if (!previous) return { weekday: 2, startTime: "19:00", endTime: "20:30", location: "" };
  const order = WEEKDAYS.map((d) => d.value as number);
  const next = order[(order.indexOf(previous.weekday) + 2) % order.length]!;
  return { ...previous, weekday: next };
}

export function slotProblems(slot: SlotInput): string | null {
  if (!TIME.test(slot.startTime) || !TIME.test(slot.endTime)) return "Heures au format HH:MM.";
  if (slot.endTime <= slot.startTime) return "L'heure de fin doit être après l'heure de début.";
  return null;
}

export function toCreateBody(slots: SlotInput[], todayKey: string, endsOn?: string): CreateTrainingSeriesDto {
  return {
    slots: slots.map((s) => ({ weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, locationLabel: s.location.trim() || null })),
    startsOn: addDaysKey(todayKey, 0),
    endsOn: endsOn ?? seasonEnd(todayKey),
  };
}
