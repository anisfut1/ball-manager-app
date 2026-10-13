import type { MatchListItem } from "@/api/endpoints/clubSpace";

/**
 * Matchs à domicile regroupés par salle, comme le web (HomeMatchesAgenda) :
 * les deux gymnases réels du club (constatés en base, jamais devinés) et
 * « Autre salle » pour le reste ; rapprochement par mot-clé, sans accents.
 */
const HOME_VENUES = [
  { key: "clavel", keyword: "CLAVEL", label: "Gymnase Maurice Clavel" },
  { key: "lido", keyword: "LIDO", label: "Complexe sportif du Lido" },
] as const;

function normalize(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

export function venueKey(venueLabel: string | null): string {
  if (!venueLabel) return "autre";
  const n = normalize(venueLabel);
  return HOME_VENUES.find((v) => n.includes(v.keyword))?.key ?? "autre";
}

/** Colonnes non vides : salles du club d'abord, « Autre salle » à la fin. */
export function homeVenueColumns(matches: MatchListItem[]): { key: string; label: string; matches: MatchListItem[] }[] {
  return [...HOME_VENUES.map((v) => ({ key: v.key as string, label: v.label as string })), { key: "autre", label: "Autre salle" }]
    .map((c) => ({ ...c, matches: matches.filter((m) => venueKey(m.venueLabel) === c.key) }))
    .filter((c) => c.matches.length > 0);
}
