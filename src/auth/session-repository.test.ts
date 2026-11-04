import { SessionStorageUnavailableError } from "./storage-errors";
import { memoryStorage, type SecretStorage } from "./secure-storage";
import { EMPTY_STATE, type ClubSession, type SessionState } from "./session-model";
import { createSessionRepository, SESSION_KEY } from "./session-repository";

/**
 * Durcissement de `load()` (A2, audit sécurité 2026-11) : une erreur de lecture du trousseau
 * (appareil verrouillé, erreur système) ne doit JAMAIS être prise pour « aucune session », sinon
 * le prochain enregistrement écrase les sessions des autres clubs ou personnes de l'appareil.
 */
const person = (id: string) => ({ licencieId: id, firstName: id, lastName: "Exemple", teamId: null });
const club = (slug: string, secret: string): ClubSession => ({ clubSlug: slug, clubName: slug, accentColor: null, timezone: "Europe/Paris", secret, people: [person(`lic-${slug}`)], activeLicencieId: `lic-${slug}` });
const ALPHA = club("club-alpha", "bmd_SENTINEL_ALPHA_0123456789abcdef");
const BETA = club("club-beta", "bmd_SENTINEL_BETA_0123456789abcdef");
const stateOf = (...clubs: ClubSession[]): SessionState => ({ v: 1, active: clubs[0]!.clubSlug, clubs: Object.fromEntries(clubs.map((c) => [c.clubSlug, c])) });

/** Stockage dont les lectures échouent tant que `failReads` est vrai ; trace les écritures. */
function flakyStorage(initial: Record<string, string> = {}) {
  const inner = memoryStorage(initial);
  const writes: string[] = [];
  let failReads = false;
  const storage: SecretStorage & { dump(): Record<string, string>; setFailReads(v: boolean): void; writes: string[] } = {
    get: async (key) => {
      if (failReads) throw new Error("errSecInteractionNotAllowed");
      return inner.get(key);
    },
    set: async (key, value) => {
      writes.push(`set:${key}`);
      await inner.set(key, value);
    },
    remove: async (key) => {
      writes.push(`remove:${key}`);
      await inner.remove(key);
    },
    dump: () => inner.dump(),
    setFailReads: (v) => {
      failReads = v;
    },
    writes,
  };
  return storage;
}

describe("session-repository — lecture normale", () => {
  it("rien de stocké : état vide, dépôt non bloqué", async () => {
    const repo = createSessionRepository(flakyStorage());
    expect(await repo.load()).toEqual(EMPTY_STATE);
    expect(repo.blocked).toBe(false);
  });

  it("session stockée : relue à l'identique", async () => {
    const state = stateOf(ALPHA, BETA);
    const repo = createSessionRepository(flakyStorage({ [SESSION_KEY]: JSON.stringify(state) }));
    expect((await repo.load()).clubs["club-beta"]?.secret).toBe(BETA.secret);
    expect(repo.blocked).toBe(false);
  });

  it("données illisibles (corrompues) : état vide, comme avant, non bloqué", async () => {
    const repo = createSessionRepository(flakyStorage({ [SESSION_KEY]: "{pas du json" }));
    expect(await repo.load()).toEqual(EMPTY_STATE);
    expect(repo.blocked).toBe(false);
  });
});

describe("session-repository — erreur de lecture du trousseau", () => {
  it("tryLoad renvoie null (jamais un état vide) et bloque le dépôt", async () => {
    const storage = flakyStorage({ [SESSION_KEY]: JSON.stringify(stateOf(ALPHA, BETA)) });
    storage.setFailReads(true);
    const repo = createSessionRepository(storage);
    expect(await repo.tryLoad()).toBeNull();
    expect(repo.blocked).toBe(true);
  });

  it("bloqué : save, clear et suppression refusent d'écrire — le trousseau reste INTACT", async () => {
    const stored = JSON.stringify(stateOf(ALPHA, BETA));
    const storage = flakyStorage({ [SESSION_KEY]: stored });
    storage.setFailReads(true);
    const repo = createSessionRepository(storage);
    await repo.tryLoad();

    await expect(repo.save(stateOf(club("club-gamma", "bmd_SENTINEL_GAMMA_0123456789abcdef")))).rejects.toBeInstanceOf(SessionStorageUnavailableError);
    await expect(repo.save(EMPTY_STATE)).rejects.toBeInstanceOf(SessionStorageUnavailableError);
    await expect(repo.clear()).rejects.toBeInstanceOf(SessionStorageUnavailableError);

    expect(storage.writes).toEqual([]);
    expect(storage.dump()[SESSION_KEY]).toBe(stored);
  });

  it("load() (compatibilité) renvoie un état vide mais bloque quand même les écritures", async () => {
    const storage = flakyStorage({ [SESSION_KEY]: JSON.stringify(stateOf(ALPHA)) });
    storage.setFailReads(true);
    const repo = createSessionRepository(storage);
    expect(await repo.load()).toEqual(EMPTY_STATE);
    await expect(repo.save(stateOf(BETA))).rejects.toBeInstanceOf(SessionStorageUnavailableError);
    expect(storage.writes).toEqual([]);
  });

  it("une lecture réussie ensuite débloque le dépôt et restitue les VRAIES sessions", async () => {
    const storage = flakyStorage({ [SESSION_KEY]: JSON.stringify(stateOf(ALPHA, BETA)) });
    storage.setFailReads(true);
    const repo = createSessionRepository(storage);
    expect(await repo.tryLoad()).toBeNull();

    storage.setFailReads(false);
    const recovered = await repo.tryLoad();
    expect(Object.keys(recovered?.clubs ?? {})).toEqual(["club-alpha", "club-beta"]);
    expect(repo.blocked).toBe(false);
    await repo.save(stateOf(ALPHA, BETA, club("club-gamma", "bmd_SENTINEL_GAMMA_0123456789abcdef")));
    expect(Object.keys(JSON.parse(storage.dump()[SESSION_KEY]!).clubs)).toHaveLength(3);
  });

  it("jamais bloqué par un simple « rien de stocké »", async () => {
    const storage = flakyStorage();
    const repo = createSessionRepository(storage);
    expect(await repo.tryLoad()).toEqual(EMPTY_STATE);
    await repo.save(stateOf(ALPHA));
    expect(JSON.parse(storage.dump()[SESSION_KEY]!).clubs["club-alpha"].secret).toBe(ALPHA.secret);
  });
});
