import { EMPTY_STATE, hasClubs, parseState, serializeState, type SessionState } from "./session-model";
import type { SecretStorage } from "./secure-storage";
import { SessionStorageUnavailableError } from "./storage-errors";

export const SESSION_KEY = "bm.sessions.v1";

/**
 * Lecture / écriture des sessions dans le stockage sécurisé (un seul enregistrement).
 *
 * Garde-fou (A2, docs/AUDIT_SECURITE_2026-11.md) : « rien de stocké » (état vide) n'est PAS la même chose
 * qu'« impossible de lire » (appareil verrouillé, erreur Keychain). Après une lecture en erreur le dépôt est
 * `blocked` : plus aucune écriture ni suppression tant qu'une lecture n'a pas réussi, sinon l'état vide
 * pris pour la réalité écraserait les sessions des autres clubs ou personnes de l'appareil.
 */
export function createSessionRepository(storage: SecretStorage) {
  let blocked = false;

  const guard = () => {
    if (blocked) throw new SessionStorageUnavailableError();
  };

  async function tryLoad(): Promise<SessionState | null> {
    try {
      const state = parseState(await storage.get(SESSION_KEY));
      blocked = false;
      return state;
    } catch {
      blocked = true;
      return null;
    }
  }

  return {
    /** `true` après une lecture en erreur, jusqu'à la prochaine lecture réussie. */
    get blocked(): boolean {
      return blocked;
    },
    /** Sessions stockées, ou `null` si le stockage n'a pas pu être lu (à ne JAMAIS confondre avec « aucune session »). */
    tryLoad,
    /** Compatibilité : état vide si illisible, MAIS le dépôt reste bloqué (les écritures sont refusées). */
    async load(): Promise<SessionState> {
      return (await tryLoad()) ?? EMPTY_STATE;
    },
    async save(state: SessionState): Promise<void> {
      guard();
      if (hasClubs(state)) await storage.set(SESSION_KEY, serializeState(state));
      else await storage.remove(SESSION_KEY);
    },
    async clear(): Promise<void> {
      guard();
      await storage.remove(SESSION_KEY);
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
