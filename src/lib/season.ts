/** Début de la saison de basket (1er août), comme le web (src/lib/season.ts). */
export function currentSeasonStart(now: Date = new Date()): Date {
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, 7, 1);
}
