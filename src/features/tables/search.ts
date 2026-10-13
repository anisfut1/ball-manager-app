/** Minuscules sans accents : « jeremy » trouve « Jérémy ». */
function fold(value: string): string {
  let out = "";
  for (const char of value.normalize("NFD")) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x0300 || code > 0x036f) out += char;
  }
  return out.toLowerCase();
}

/**
 * Recherche du panneau de désignation (comme le web : nom OU équipe), à
 * chaque lettre tapée. Plusieurs mots : tous doivent être trouvés
 * (« clar chri », « u15 lina »).
 */
export function matchesSearch(query: string, name: string, teams: readonly { name: string }[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = fold(`${name} ${teams.map((t) => t.name).join(" ")}`);
  return words.every((w) => haystack.includes(w));
}
