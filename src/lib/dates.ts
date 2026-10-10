/**
 * Dates et heures — TOUJOURS dans le fuseau du club (club.timezone), jamais
 * celui du téléphone : un parent en vacances voit l'heure du gymnase.
 * Module unique : aucun écran ne formate une date lui-même.
 */
const LOCALE = "fr-FR";

function parts(iso: string | Date, tz: string): Record<string, string> {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short" }).formatToParts(date)) out[p.type] = p.value;
  if (out.hour === "24") out.hour = "00";
  return out;
}

/** Clé de jour `YYYY-MM-DD` dans le fuseau du club (regroupement du planning). */
export function dayKey(iso: string | Date, tz: string): string {
  const p = parts(iso, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** « 18:00 » */
export function formatTime(iso: string, tz: string): string {
  const p = parts(iso, tz);
  return `${p.hour}:${p.minute}`;
}

/** « samedi 18 octobre » */
export function formatLongDay(iso: string, tz: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}

/** « sam. 18 oct. » */
export function formatShortDay(iso: string, tz: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));
}

function addDaysKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** « Aujourd'hui », « Demain », « Samedi » (dans la semaine), sinon « sam. 18 oct. ». */
export function relativeDay(iso: string, tz: string, now: Date = new Date()): string {
  const key = dayKey(iso, tz);
  const today = dayKey(now, tz);
  if (key === today) return "Aujourd'hui";
  if (key === addDaysKey(today, 1)) return "Demain";
  for (let i = 2; i < 7; i += 1) {
    if (key === addDaysKey(today, i)) {
      const w = new Intl.DateTimeFormat(LOCALE, { timeZone: tz, weekday: "long" }).format(new Date(iso));
      return w.charAt(0).toUpperCase() + w.slice(1);
    }
  }
  return formatShortDay(iso, tz);
}

/** « Demain · 19:00 » */
export function relativeDayTime(iso: string, tz: string, now: Date = new Date()): string {
  return `${relativeDay(iso, tz, now)} · ${formatTime(iso, tz)}`;
}

/** Décalage (minutes) du fuseau à cet instant. */
function offsetMinutes(utc: Date, tz: string): number {
  const p = parts(utc, tz);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return Math.round((asUtc - Math.floor(utc.getTime() / 60_000) * 60_000) / 60_000);
}

/**
 * Heure locale du club (date `YYYY-MM-DD` + `HH:MM`) → instant ISO UTC.
 * Gère l'heure d'été (deux passes sur le décalage).
 */
export function zonedToUtcIso(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let guess = new Date(naive - offsetMinutes(new Date(naive), tz) * 60_000);
  guess = new Date(naive - offsetMinutes(guess, tz) * 60_000);
  return guess.toISOString();
}

/** Plage `[from, to]` en jours (YYYY-MM-DD) à partir d'aujourd'hui dans le fuseau du club. */
export function dayRange(tz: string, daysBefore: number, daysAfter: number, now: Date = new Date()): { from: string; to: string } {
  const today = dayKey(now, tz);
  return { from: addDaysKey(today, -daysBefore), to: addDaysKey(today, daysAfter) };
}

export { addDaysKey };
