/**
 * « Journée » de basket = le week-end (samedi + dimanche), dans le fuseau du
 * club. Repris de ball-manager-web (src/lib/timezone.ts) : mêmes bornes,
 * mêmes libellés, technique DST-safe (jamais « +48 h » codé en dur).
 */

function zonedWallTimeToUtc(year: number, month: number, day: number, timezone: string): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(utcGuess);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const readAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return new Date(utcGuess.getTime() + (utcGuess.getTime() - readAsUtc));
}

/** « YYYY-MM-DD » du jour, vu dans `timezone`. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Samedi du week-end en cours (samedi ou dimanche) ou du prochain. */
export function currentOrNextWeekendSaturday(timezone: string, now: Date = new Date()): string {
  const today = todayIn(timezone, now);
  const weekday = weekdayOf(today);
  if (weekday === 6) return today;
  if (weekday === 0) return addDays(today, -1);
  return addDays(today, 6 - weekday);
}

/** Fenêtre `[from, to)` en ISO UTC : samedi 00:00 → lundi 00:00 dans `timezone`. */
export function weekendRange(saturday: string, timezone: string): { from: string; to: string } {
  const [sy, sm, sd] = saturday.split("-").map(Number);
  const [my, mm, md] = addDays(saturday, 2).split("-").map(Number);
  return { from: zonedWallTimeToUtc(sy, sm, sd, timezone).toISOString(), to: zonedWallTimeToUtc(my, mm, md, timezone).toISOString() };
}

function dayAndMonth(dateStr: string): { day: string; month: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return { day: date.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric" }), month: date.toLocaleDateString("fr-FR", { timeZone: "UTC", month: "long" }) };
}

/** « Week-end du 17 au 18 octobre » (ou « du 31 octobre au 1 novembre »). */
export function formatWeekendLabel(saturday: string): string {
  const sat = dayAndMonth(saturday);
  const sun = dayAndMonth(addDays(saturday, 1));
  return `Week-end du ${sat.month === sun.month ? `${sat.day} au ${sun.day} ${sun.month}` : `${sat.day} ${sat.month} au ${sun.day} ${sun.month}`}`;
}
