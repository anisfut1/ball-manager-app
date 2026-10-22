/**
 * Jours « AAAA-MM-JJ » (calendrier, sans fuseau) pour les écrans
 * d'administration — fonctions PURES, testées.
 */
export function dayKeyParts(day: string): { year: number; month: number; day: number } {
  const [year, month, d] = day.split("-").map(Number);
  return { year: year!, month: month!, day: d! };
}

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDays(day: string, delta: number): string {
  const { year, month, day: d } = dayKeyParts(day);
  return new Date(Date.UTC(year, month - 1, d + delta)).toISOString().slice(0, 10);
}

/** Aujourd'hui dans le fuseau du club. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Semaines du mois (lundi en premier), `null` hors du mois. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (first + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => dayKey(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function monthTitle(year: number, month: number): string {
  const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « samedi 7 novembre » ; « du 7 au 9 novembre » pour une période. */
export function closureDates(startDate: string, endDate: string): string {
  const fmt = (key: string, options: Intl.DateTimeFormatOptions) => new Date(`${key}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...options });
  if (startDate === endDate) return fmt(startDate, { weekday: "long", day: "numeric", month: "long" });
  return `du ${fmt(startDate, { day: "numeric", month: "long" })} au ${fmt(endDate, { day: "numeric", month: "long" })}`;
}
