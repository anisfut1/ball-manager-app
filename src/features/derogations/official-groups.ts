import type { OfficialDerogation as DerogationListItemDto } from "@/api/endpoints/derogations";

/**
 * Regroupement des dérogations FBI PAR MATCH — retour du club, 2026-10-07 :
 * "je veux avoir l'historique des dérogs en 1 carte pour 1 match, et pas 1
 * carte par-ci par-là, ça peut induire en erreur" (ex. rencontre 9608 : 3
 * dérogations dont 2 refusées, chacune dans sa propre carte).
 */
export interface DerogationMatchGroup {
  key: string;
  /** Dérogations de ce match, dans l'ordre chronologique de dépôt (dates inconnues en dernier). */
  derogations: DerogationListItemDto[];
  /** Première ligne du groupe — porte les infos du match (numéro, équipe, adversaire, date FFBB). */
  match: DerogationListItemDto;
  actionRequired: boolean;
}

/** "jj/mm/aaaa[ HH:MM]" (format FBI) → horodatage, ou `null` si absent/illisible — jamais deviné. */
export function parseFbiDate(value: string | null | undefined): number | null {
  const match = value?.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const time = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] ?? 0), Number(match[5] ?? 0));
  return Number.isNaN(time) ? null : time;
}

/** Ordre chronologique d'une dérogation : sa date de dépôt sur FBI. */
function derogationTime(derogation: DerogationListItemDto): number | null {
  return parseFbiDate(derogation.dateDepot);
}

/** Dérogation acceptée dont l'horaire demandé est l'horaire officiel actuel du match. */
export function isRetainedSchedule(d: DerogationListItemDto): boolean {
  return etatTone(d.etat) === "success" && requestMatchesOfficial(d, parisSlot(d.matchDatetime));
}

/**
 * Ordre CHRONOLOGIQUE (retour du club, 2026-10-08 : "le 11 on l'a calée à
 * 16h30 et le 21 on l'a remise à 17h30") : la plus ancienne déposée en
 * premier ; sans date de dépôt connue, en dernier, sans ordre inventé.
 */
function compareDerogations(a: DerogationListItemDto, b: DerogationListItemDto): number {
  const ta = derogationTime(a);
  const tb = derogationTime(b);
  if (ta !== null && tb !== null) return ta - tb;
  if (ta !== null) return -1;
  if (tb !== null) return 1;
  return 0;
}

/** Ce que touche une dérogation (date, horaire, salle) : cases FBI si lues, sinon valeurs demandées présentes. */
function changedKinds(d: DerogationListItemDto): Set<"date" | "horaire" | "salle"> {
  const kinds = new Set<"date" | "horaire" | "salle">();
  const known = changesKnown(d);
  if (known ? d.modifierDate : d.dateRencontreDemandee) kinds.add("date");
  if (known ? d.modifierHoraire : d.heureDemandee) kinds.add("horaire");
  if (d.modifierSalle) kinds.add("salle");
  return kinds;
}

/**
 * Dérogation acceptée remplacée par une dérogation acceptée déposée PLUS
 * TARD qui change la même chose (date, horaire ou salle) — ex. n°25 :
 * salle → Lido le 14/09, puis salle → Maurice Clavel le 18/09. Dates de
 * dépôt connues des deux côtés, sinon rien n'est affirmé. Renvoie la date
 * de dépôt de la remplaçante.
 */
export function supersededBy(d: DerogationListItemDto, all: DerogationListItemDto[]): string | null {
  if (etatTone(d.etat) !== "success") return null;
  const kinds = changedKinds(d);
  const t = derogationTime(d);
  if (kinds.size === 0 || t === null) return null;
  const next = all
    .filter((o) => o !== d && etatTone(o.etat) === "success" && [...changedKinds(o)].some((k) => kinds.has(k)))
    .map((o) => ({ o, t: derogationTime(o) }))
    .filter((x): x is { o: DerogationListItemDto; t: number } => x.t !== null && x.t > t)
    .sort((a, b) => a.t - b.t)[0];
  return next ? next.o.dateDepot : null;
}

function groupKey(derogation: DerogationListItemDto): string {
  if (derogation.matchId) return `match:${derogation.matchId}`;
  if (derogation.numero) return `numero:${derogation.numero}`;
  return `derogation:${derogation.id}`;
}

/**
 * Un groupe par match (`matchId`, sinon numéro de rencontre, sinon la
 * dérogation seule). Ordre des groupes : action requise d'abord, puis match
 * le plus proche dans le temps en premier (date FFBB), comme la liste
 * d'origine sinon.
 */
export function groupDerogationsByMatch(derogations: DerogationListItemDto[]): DerogationMatchGroup[] {
  const byKey = new Map<string, DerogationListItemDto[]>();
  for (const derogation of derogations) {
    const key = groupKey(derogation);
    byKey.set(key, [...(byKey.get(key) ?? []), derogation]);
  }

  const groups: DerogationMatchGroup[] = Array.from(byKey.entries()).map(([key, items]) => {
    const sorted = [...items].sort(compareDerogations);
    return { key, derogations: sorted, match: sorted[0]!, actionRequired: sorted.some((d) => d.actionRequired) };
  });

  return groups.sort((a, b) => {
    if (a.actionRequired !== b.actionRequired) return a.actionRequired ? -1 : 1;
    const ta = a.match.matchDatetime ? Date.parse(a.match.matchDatetime) : NaN;
    const tb = b.match.matchDatetime ? Date.parse(b.match.matchDatetime) : NaN;
    if (!Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
    if (!Number.isNaN(ta)) return -1;
    if (!Number.isNaN(tb)) return 1;
    return 0;
  });
}

/** Date "jj/mm/aaaa" et heure "HH:MM" d'un horodatage, en heure française. */
export function parisSlot(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null;
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return null;
  return {
    date: value.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric" }),
    time: value.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }),
  };
}

/** Le détail FBI (page de la dérogation) a-t-il été récupéré ? Sinon seules les colonnes du tableau sont connues. */
export function hasDerogationDetail(d: DerogationListItemDto): boolean {
  return Boolean(d.demandeur || d.motif || d.dateRencontreDemandee || d.heureDemandee || d.adversaire || d.dateReponse || d.acceptation || d.motifRefus);
}

/**
 * La date/heure DEMANDÉE correspond-elle à l'horaire officiel actuel du
 * match ? Comparaison stricte des seuls champs renseignés sur FBI (une date
 * demandée absente n'est jamais supposée) ; `false` si rien n'est demandé.
 */
export function requestMatchesOfficial(d: DerogationListItemDto, official: { date: string; time: string } | null): boolean {
  if (!official) return false;
  const date = d.dateRencontreDemandee?.trim() || null;
  const time = d.heureDemandee?.trim() || null;
  if (!date && !time) return false;
  return (!date || date === official.date) && (!time || time === official.time);
}

export type DerogationVerdict =
  | { kind: "action_required" }
  | { kind: "pending" }
  | { kind: "accepted_current" }
  | { kind: "all_refused" }
  | { kind: "settled" };

/**
 * Conclusion d'un match en une phrase (retour du club, 2026-10-07 : "le
 * match a été joué à 17h30 mais dans les dérogs rien me le fait
 * comprendre"). Uniquement à partir des états FBI et de l'horaire officiel,
 * jamais d'ordre chronologique supposé entre dérogations non datées.
 */
export function derogationVerdict(group: DerogationMatchGroup): DerogationVerdict {
  if (group.actionRequired) return { kind: "action_required" };
  const tones = group.derogations.map((d) => etatTone(d.etat));
  if (tones.includes("warning")) return { kind: "pending" };
  const official = parisSlot(group.match.matchDatetime);
  if (group.derogations.some((d) => etatTone(d.etat) === "success" && requestMatchesOfficial(d, official))) return { kind: "accepted_current" };
  if (tones.length > 0 && tones.every((t) => t === "danger")) return { kind: "all_refused" };
  return { kind: "settled" };
}

/**
 * Ce que la dérogation demande de changer, avec la NOUVELLE valeur (retour
 * du club, 2026-10-08 : "si y'a une dérog c'est que ça a changé"). Cases
 * du formulaire FBI ("Modifier la date / l'horaire / la salle", "Inverser
 * la rencontre / seulement les équipes") ; tant qu'elles n'ont pas été
 * lues, repli sur les valeurs demandées présentes. Jamais d'"avant" :
 * FBI ne le donne pas sur la dérogation.
 */
export function describeRequestedChanges(d: DerogationListItemDto): string[] {
  const known = changesKnown(d);
  const changes: string[] = [];
  if (known ? d.modifierDate : d.dateRencontreDemandee) changes.push(`Date → ${d.dateRencontreDemandee ?? "non précisée"}`);
  if (known ? d.modifierHoraire : d.heureDemandee) changes.push(`Horaire → ${d.heureDemandee ?? "non précisé"}`);
  if (d.modifierSalle) changes.push(`Salle → ${d.salleDemandee ?? "non précisée"}`);
  if (d.inverserRencontre) changes.push("Inversion de la rencontre");
  if (d.inverserEquipe) changes.push("Inversion des équipes seulement");
  return changes;
}

/** Les cases du formulaire ont-elles été lues pour cette dérogation ? */
export function changesKnown(d: DerogationListItemDto): boolean {
  return [d.modifierDate, d.modifierHoraire, d.modifierSalle, d.inverserRencontre, d.inverserEquipe].some((v) => v !== null && v !== undefined);
}

/** Couleur d'un état FBI — uniquement sur les mots présents dans le libellé, neutre sinon. */
export function etatTone(etat: string | null | undefined): "success" | "danger" | "warning" | "neutral" {
  const value = (etat ?? "").toLowerCase();
  if (value.includes("refus")) return "danger";
  if (value.includes("accept")) return "success";
  if (value.includes("en cours")) return "warning";
  return "neutral";
}
