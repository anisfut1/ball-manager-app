/**
 * Requête de recherche de nom envoyable au serveur (mêmes règles que
 * ball-manager-back, name-search.ts `checkQuery`) : au moins deux mots de deux
 * lettres (prénom ET nom), six mots au plus, 80 caractères au plus. Sinon
 * `null` : on n'interroge pas le serveur (limite de 30 recherches par minute).
 */
export function searchableNameQuery(raw: string): string | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text || text.length > 80) return null;
  const words = text.split(" ");
  if (words.length > 6) return null;
  return words.filter((w) => w.length >= 2).length >= 2 ? text : null;
}

/** Délai après la dernière frappe avant de chercher. */
export const NAME_SEARCH_DEBOUNCE_MS = 450;
