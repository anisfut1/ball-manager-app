import type { DeleteAccountResult } from "@/api/endpoints/auth";
import { ApiError } from "@/api/errors";
import { deleteAccount } from "./auth-service";
import type { ClubSession, SessionState } from "./session-model";

// Données fictives uniquement.
const club = (clubSlug: string): ClubSession => ({ clubSlug, clubName: clubSlug.toUpperCase(), accentColor: null, timezone: "Europe/Paris", secret: `bmd_sentinelle_${clubSlug}`, people: [], activeLicencieId: null });
const state: SessionState = { v: 1, active: "club-a", clubs: { "club-a": club("club-a"), "club-b": club("club-b") } };
const failed: DeleteAccountResult = { kind: "failed", error: new ApiError("server", "x", 500) };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("deleteAccount (service)", () => {
  it("séquentiel : le club suivant n'est appelé qu'après la réponse du précédent, avec son propre secret", async () => {
    const first = deferred<DeleteAccountResult>();
    const calls: string[] = [];
    const api = {
      deleteAccount: jest.fn((slug: string, secret: string) => {
        calls.push(`${slug}:${secret}`);
        return slug === "club-a" ? first.promise : Promise.resolve<DeleteAccountResult>({ kind: "deleted" });
      }),
    };
    const done = deleteAccount(api, state, async () => undefined);
    await tick();
    expect(calls).toEqual(["club-a:bmd_sentinelle_club-a"]);
    first.resolve({ kind: "deleted" });
    await done;
    expect(calls).toEqual(["club-a:bmd_sentinelle_club-a", "club-b:bmd_sentinelle_club-b"]);
  });

  it("un échec laisse CE club intact, nettoie les autres et le dit", async () => {
    const removed: string[] = [];
    const api = { deleteAccount: async (slug: string) => (slug === "club-a" ? failed : ({ kind: "deleted" } as const)) };
    const outcome = await deleteAccount(api, state, async (_next, slug) => void removed.push(slug));
    expect(removed).toEqual(["club-b"]);
    expect(Object.keys(outcome.state.clubs)).toEqual(["club-a"]);
    expect(outcome.failed).toEqual([{ clubSlug: "club-a", clubName: "CLUB-A" }]);
  });
});
