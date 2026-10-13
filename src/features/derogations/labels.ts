import type { DerogationAction, DerogationStatus, DerogationSummary } from "@/api/endpoints/derogations";
import type { BadgeTone } from "@/components/ui";
import { formatTime as clubTime } from "@/lib/dates";

/**
 * Libellés et regroupements des demandes de dérogation internes — COPIE du
 * web (SCSB `features/derogation-requests/labels.ts`), dates dans le fuseau
 * du CLUB (`timezone` fourni par l'API), jamais celui du téléphone.
 */

export const STATUS_META: Record<DerogationStatus, { label: string; tone: BadgeTone }> = {
  REQUESTED: { label: "Demande envoyée", tone: "info" },
  IN_PROGRESS: { label: "En cours", tone: "info" },
  NEEDS_CHANGE: { label: "Nouveau créneau demandé", tone: "warning" },
  COMPLETED: { label: "Traitée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const ACTION_LABELS: Record<DerogationAction, string> = {
  TAKE_IN_CHARGE: "Je m'en occupe",
  REQUEST_CHANGE: "Ce n'est pas possible",
  COMPLETE: "Marquer comme traitée",
  CANCEL: "Annuler la demande",
};

export const NO_COORDINATOR_MESSAGE = "Aucun coordinateur n'est actuellement configuré pour recevoir les demandes de dérogation.";
export const AWAY_NOTICE = "Match à l'extérieur — le créneau devra être confirmé avec le club adverse.";
export const PENDING_WARNING = "Une autre demande en cours vise ce créneau.";

export const ACTIVE_STATUSES: readonly DerogationStatus[] = ["REQUESTED", "IN_PROGRESS", "NEEDS_CHANGE"];

export function isActive(status: DerogationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function parts(iso: string, timezone: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleString("fr-FR", { timeZone: timezone, ...options });
}

/** « dimanche 11 octobre » */
export function formatDayLong(iso: string, timezone: string): string {
  return parts(iso, timezone, { weekday: "long", day: "numeric", month: "long" });
}

/** « Dimanche 11 octobre » */
export function formatDayLongCapitalized(iso: string, timezone: string): string {
  const s = formatDayLong(iso, timezone);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 15:00 » (formatToParts : fiable sous Hermes). */
export function formatTime(iso: string, timezone: string): string {
  return clubTime(iso, timezone);
}

/** « Sam. 3 oct. · 18:00 » */
export function formatShortDateTime(iso: string | null, timezone: string): string {
  if (!iso) return "Date à confirmer";
  const day = parts(iso, timezone, { weekday: "short", day: "numeric", month: "short" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${formatTime(iso, timezone)}`;
}

/** « il y a 5 min », « hier », « 3 oct. » — activité récente. */
export function formatRelative(iso: string, now: Date = new Date(), timezone = "Europe/Paris"): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffH < 48) return "hier";
  return parts(iso, timezone, { day: "numeric", month: "short" });
}

/** "YYYY-MM-DD" d'un instant dans le fuseau du club. */
export function localDateKey(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

export interface WeekendDay {
  date: string;
  weekday: "SAM" | "DIM";
  day: string;
  month: string;
  label: string;
}

/** Samedis et dimanches à venir (aujourd'hui exclu), dans le fuseau du club. */
export function upcomingWeekendDays(now: Date, timezone: string, weekends = 6): WeekendDay[] {
  const today = localDateKey(now, timezone);
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const out: WeekendDay[] = [];
  for (let offset = 1; out.length < weekends * 2 && offset < 7 * (weekends + 2); offset++) {
    const date = new Date(Date.UTC(y, m - 1, d + offset));
    const wd = date.getUTCDay();
    if (wd !== 6 && wd !== 0) continue;
    out.push({
      date: date.toISOString().slice(0, 10),
      weekday: wd === 6 ? "SAM" : "DIM",
      day: String(date.getUTCDate()),
      month: date.toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase(),
      label: date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
    });
  }
  return out;
}

export interface RequestSection {
  key: string;
  title: string;
  description: string;
  requests: DerogationSummary[];
}

/** Sections de la page Dérogations (inbox coordinateur ou suivi coach). */
export function groupRequests(requests: readonly DerogationSummary[], manager: boolean): RequestSection[] {
  const by = (statuses: DerogationStatus[]) => requests.filter((r) => statuses.includes(r.status));
  const sections: RequestSection[] = manager
    ? [
        { key: "todo", title: "À traiter", description: "Nouvelles demandes et créneaux reproposés par les coachs.", requests: by(["REQUESTED"]) },
        { key: "progress", title: "En cours", description: "Demandes que tu as prises en charge.", requests: by(["IN_PROGRESS"]) },
        { key: "waiting", title: "En attente du coach", description: "Un autre créneau a été demandé au coach.", requests: by(["NEEDS_CHANGE"]) },
        { key: "done", title: "Terminées", description: "Traitées ou annulées.", requests: by(["COMPLETED", "CANCELLED"]) },
      ]
    : [
        { key: "review", title: "À revoir", description: "Le coordinateur demande un autre créneau.", requests: by(["NEEDS_CHANGE"]) },
        { key: "waiting", title: "En attente", description: "Envoyées au coordinateur, pas encore prises en charge.", requests: by(["REQUESTED"]) },
        { key: "progress", title: "En cours", description: "Le coordinateur s'en occupe.", requests: by(["IN_PROGRESS"]) },
        { key: "done", title: "Terminées", description: "Traitées ou annulées.", requests: by(["COMPLETED", "CANCELLED"]) },
      ];
  return sections.filter((s) => s.requests.length > 0);
}

/** Archivée : demande terminée / annulée, ou match passé. Repliée par défaut. */
export function isArchivedRequest(r: Pick<DerogationSummary, "status" | "originalScheduledAt" | "requestedStartAt">, now: Date): boolean {
  if (r.status === "COMPLETED" || r.status === "CANCELLED") return true;
  const times = [r.originalScheduledAt, r.requestedStartAt].filter((v): v is string => Boolean(v)).map((v) => Date.parse(v)).filter(Number.isFinite);
  return times.length > 0 && Math.max(...times) < now.getTime();
}

/** Libellé court de l'équipe du club pour une demande. */
export function teamLabel(match: { teamName: string | null; categoryLabel: string | null }): string {
  return match.teamName ?? match.categoryLabel ?? "Équipe";
}
