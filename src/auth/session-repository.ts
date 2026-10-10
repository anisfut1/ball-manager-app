import { EMPTY_STATE, hasClubs, parseState, serializeState, type SessionState } from "./session-model";
import type { SecretStorage } from "./secure-storage";

export const SESSION_KEY = "bm.sessions.v1";

/** Lecture / écriture des sessions dans le stockage sécurisé (un seul enregistrement). */
export function createSessionRepository(storage: SecretStorage) {
  return {
    async load(): Promise<SessionState> {
      try {
        return parseState(await storage.get(SESSION_KEY));
      } catch {
        return EMPTY_STATE;
      }
    },
    async save(state: SessionState): Promise<void> {
      if (hasClubs(state)) await storage.set(SESSION_KEY, serializeState(state));
      else await storage.remove(SESSION_KEY);
    },
    async clear(): Promise<void> {
      await storage.remove(SESSION_KEY);
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
