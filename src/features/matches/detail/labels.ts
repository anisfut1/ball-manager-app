import type { BadgeTone } from "@/components/ui";

/** Libellés de la fiche match, repris tels quels de ball-manager-web (src/features/matches/detail/labels.ts). */

export type MatchTab = "informations" | "composition" | "statistiques" | "officiels" | "emarque";

export const MATCH_TABS: { value: MatchTab; label: string }[] = [
  { value: "informations", label: "Informations" },
  { value: "composition", label: "Composition" },
  { value: "statistiques", label: "Statistiques" },
  { value: "officiels", label: "Officiels" },
  { value: "emarque", label: "e-Marque" },
];

export function parseMatchTab(value: string | string[] | undefined): MatchTab {
  return MATCH_TABS.some((t) => t.value === value) ? (value as MatchTab) : "informations";
}

export const REFEREE_ROLE_LABELS: Record<string, string> = { referee_1: "1er arbitre", referee_2: "2e arbitre", referee_3: "3e arbitre" };
export const TABLE_OFFICIAL_ROLE_LABELS: Record<string, string> = {
  scorer: "Marqueur",
  assistant_scorer: "Aide-marqueur",
  timekeeper: "Chronométreur",
  shot_clock_operator: "Chronométreur des 24s",
  commissioner: "Commissaire",
  other: "Autre",
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  scheduled: "À venir",
  played: "Joué",
  postponed: "Reporté",
  cancelled: "Annulé",
  forfeit: "Forfait",
};

export const EMARQUE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  not_applicable: { label: "Non concerné", tone: "neutral" },
  pending: { label: "En attente de traitement", tone: "info" },
  waiting_for_emarque: { label: "En attente du document FBI", tone: "info" },
  discovered: { label: "Document découvert", tone: "info" },
  downloading: { label: "Téléchargement en cours", tone: "info" },
  downloaded: { label: "Téléchargé", tone: "info" },
  parsing: { label: "Traitement en cours", tone: "info" },
  imported: { label: "Importé", tone: "success" },
  error: { label: "Erreur de traitement", tone: "danger" },
  needs_review: { label: "En cours de vérification", tone: "warning" },
  not_available: { label: "Pas de feuille e-Marque", tone: "neutral" },
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  emarque_zip: "Export e-Marque complet",
  match_sheet: "Feuille de match",
  summary: "Résumé",
  shot_chart: "Positions de tirs",
  other: "Autre document",
};

export function formatSecondsPlayed(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

export function personName(p: { firstName: string | null; lastName: string | null }): string {
  return `${p.firstName ?? ""} ${p.lastName ?? "(nom non lu)"}`.trim();
}
