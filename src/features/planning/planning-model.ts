import type { PlanningEvent } from "@/api/endpoints/teamLife";
import { dayKey, formatLongDay } from "@/lib/dates";

export type PlanningFilter = "ALL" | "MATCH" | "TRAINING";

export interface PlanningSection {
  key: string;
  title: string;
  data: PlanningEvent[];
}

/** Regroupe par jour DU CLUB (pas du téléphone), trié chronologiquement. */
export function groupByDay(events: readonly PlanningEvent[], tz: string, filter: PlanningFilter = "ALL"): PlanningSection[] {
  const sections = new Map<string, PlanningSection>();
  const sorted = [...events].filter((e) => filter === "ALL" || e.kind === filter).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (const e of sorted) {
    const key = dayKey(e.startsAt, tz);
    let section = sections.get(key);
    if (!section) {
      const title = formatLongDay(e.startsAt, tz);
      section = { key, title: title.charAt(0).toUpperCase() + title.slice(1), data: [] };
      sections.set(key, section);
    }
    section.data.push(e);
  }
  return [...sections.values()];
}

/** Index de la première section à partir d'aujourd'hui (défilement initial). */
export function firstUpcomingIndex(sections: readonly PlanningSection[], todayKey: string): number {
  const i = sections.findIndex((s) => s.key >= todayKey);
  return i === -1 ? Math.max(0, sections.length - 1) : i;
}
