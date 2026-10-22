import type { MatchListItemDto } from "@/api/endpoints/admin";

/**
 * Reprise telle quelle de ball-manager-web (src/features/matches/venue-booking.ts) :
 * mêmes règles que la page « Réservation salle » du site.
 *
 * Planning mensuel « Réservation salle » (demande du club, 2026-10-20) : une
 * ligne par jour (samedis et dimanches du mois, plus tout autre jour qui a
 * un match), une colonne par équipe, l'heure dans la case — le tableau que
 * le club tenait à la main pour réserver les gymnases, mais calculé depuis
 * les matchs programmés.
 */
export interface BookingCell {
  matchId: string;
  time: string;
  opponent: string | null;
  /** Gymnase quand ce n'est pas le gymnase principal du mois (ex. « Lido »). */
  venue: string | null;
  isHome: boolean;
  status: MatchListItemDto["status"];
}

export interface BookingDay {
  key: string; // AAAA-MM-JJ, fuseau du club
  label: string; // « Samedi 7 »
  weekday: number; // 0 = dimanche
  /** Premier jour d'un nouveau week-end : séparateur visuel avant la ligne. */
  startsWeek: boolean;
  cells: Record<string, BookingCell[]>;
}

export interface BookingGrid {
  monthLabel: string; // « Novembre 2026 »
  teams: string[];
  days: BookingDay[];
  mainVenue: string | null;
  matchCount: number;
}

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function partsIn(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** « 11h », « 15h30 » — comme le tableau du club. */
export function bookingTime(hour: number, minute: number): string {
  return `${hour}h${minute ? String(minute).padStart(2, "0") : ""}`;
}

/**
 * Libellé court d'un gymnase : « COMPLEXE SPORTIF DU LIDO — 213 RUE DU
 * DAUPHINE » (format FFBB : nom — adresse) ou « … - SETE » → « Lido ».
 */
export function shortVenue(label: string): string {
  const name = label.split(/\s[—–-]\s|,/)[0]?.trim() || label;
  const words = name.split(/\s+/).filter((w) => !/^(GYMNASE|COMPLEXE|SPORTIF|SALLE|PALAIS|DES|DU|DE|LA|LE|SPORTS?|OMNISPORTS?)$/i.test(w));
  const pick = words.length ? words.slice(-1)[0] : name;
  return pick.charAt(0).toUpperCase() + pick.slice(1).toLowerCase();
}

/** Mois « AAAA-MM » valide, sinon le mois en cours (fuseau du club). */
export function parseBookingMonth(value: string | undefined, timeZone: string, now: Date): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (match) {
    const month = Number(match[2]);
    if (month >= 1 && month <= 12) return { year: Number(match[1]), month };
  }
  const p = partsIn(now, timeZone);
  return { year: p.year, month: p.month };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Bornes UTC larges du mois (± 1 jour) : le tri fin se fait dans le fuseau du club. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, month - 1, 1) - 86_400_000);
  const to = new Date(Date.UTC(year, month, 1) + 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function monthLabel(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Ordre du club : catégorie d'âge croissante (U9, U11…), séniors à la fin, puis nom. */
export function compareTeams(a: string, b: string): number {
  const rank = (name: string) => {
    const u = /U\s?(\d{1,2})/i.exec(name);
    if (u) return Number(u[1]);
    if (/s[ée]nior/i.test(name)) return 50;
    return 60;
  };
  return rank(a) - rank(b) || a.localeCompare(b, "fr", { numeric: true });
}

/** 3x3 : hors planning des salles (retour du club, 2026-10-20). */
export function isThreeOnThree(match: Pick<MatchListItemDto, "competitionName" | "categoryLabel">): boolean {
  return /3\s?x\s?3/i.test(`${match.competitionName ?? ""} ${match.categoryLabel ?? ""}`);
}

export function buildBookingGrid(input: { matches: MatchListItemDto[]; teams: string[]; year: number; month: number; timeZone: string; homeOnly: boolean }): BookingGrid {
  const { year, month, timeZone, homeOnly } = input;
  // Équipes qui ne jouent qu'en 3x3 (engagées au nom du club) : pas de colonne.
  const fiveOnFive = new Set(input.matches.filter((m) => !isThreeOnThree(m)).map((m) => m.teamName));
  const threeOnly = new Set(input.matches.filter((m) => isThreeOnThree(m) && !fiveOnFive.has(m.teamName)).map((m) => m.teamName));
  const inMonth = input.matches.filter((m) => {
    if (isThreeOnThree(m)) return false;
    if (!m.matchDatetime || !m.teamName) return false;
    if (homeOnly && m.isHome === false) return false;
    const p = partsIn(new Date(m.matchDatetime), timeZone);
    return p.year === year && p.month === month;
  });

  // Gymnase le plus fréquent à domicile : il n'est pas répété dans les cases.
  const counts = new Map<string, number>();
  for (const m of inMonth) if (m.isHome !== false && m.venueLabel) counts.set(m.venueLabel, (counts.get(m.venueLabel) ?? 0) + 1);
  const mainVenue = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const days = new Map<string, BookingDay>();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dayFor = (day: number): BookingDay => {
    const key = `${monthKey(year, month)}-${String(day).padStart(2, "0")}`;
    let entry = days.get(key);
    if (!entry) {
      const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      entry = { key, label: `${WEEKDAYS[weekday]} ${day}`, weekday, startsWeek: false, cells: {} };
      days.set(key, entry);
    }
    return entry;
  };
  for (let day = 1; day <= daysInMonth; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday === 0 || weekday === 6) dayFor(day);
  }

  const teams = new Set(input.teams.filter((team) => !threeOnly.has(team)));
  for (const m of inMonth) {
    const date = new Date(m.matchDatetime as string);
    const p = partsIn(date, timeZone);
    const team = m.teamName as string;
    teams.add(team);
    const entry = dayFor(p.day);
    const isHome = m.isHome !== false;
    (entry.cells[team] ??= []).push({
      matchId: m.id,
      time: bookingTime(p.hour, p.minute),
      opponent: m.opponentName,
      venue: !isHome ? "Extérieur" : m.venueLabel && m.venueLabel !== mainVenue ? shortVenue(m.venueLabel) : null,
      isHome,
      status: m.status,
    });
  }
  for (const entry of days.values()) for (const cells of Object.values(entry.cells)) cells.sort((a, b) => a.time.localeCompare(b.time, "fr", { numeric: true }));

  const ordered = [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
  ordered.forEach((day, index) => {
    const previous = ordered[index - 1];
    // Nouveau bloc quand on quitte un dimanche ou qu'un jour sépare deux lignes.
    day.startsWeek = !!previous && (previous.weekday === 0 || Number(day.key.slice(8)) - Number(previous.key.slice(8)) > 1);
  });

  return { monthLabel: monthLabel(year, month), teams: [...teams].sort(compareTeams), days: ordered, mainVenue, matchCount: inMonth.length };
}
