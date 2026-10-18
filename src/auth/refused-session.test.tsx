import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import createClient from "openapi-fetch";
import { router } from "expo-router";
import type { paths } from "@/api/generated/schema";
import { setApiClientForTests } from "@/api/client";
import { authApi } from "@/api/endpoints/auth";
import { RefusedSessionRedirect } from "@/navigation/RefusedSessionRedirect";
import { authGuard } from "@/navigation/auth-guard";
import { clearPendingDestination } from "@/linking/pendingDestination";
import { SessionProvider, useSession } from "./SessionProvider";
import { parseState, type ClubSession, type SessionState } from "./session-model";
import { SESSION_KEY } from "./session-repository";

jest.mock("expo-notifications", () => ({}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock("@/auth/secure-storage", () => {
  const actual = jest.requireActual("@/auth/secure-storage");
  return { ...actual, secureStorage: actual.memoryStorage() };
});

const storage = (jest.requireMock("@/auth/secure-storage") as { secureStorage: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void>; dump(): Record<string, string> } }).secureStorage;
const replace = router.replace as jest.Mock;

// Le secret doit respecter /^bmd_[A-Za-z0-9_-]{20,}$/ (sinon l'état stocké est jugé illisible).
const SENTINEL_ALPHA = "bmd_SENTINEL_ALPHA_0123456789abcdef";
const SENTINEL_BETA = "bmd_SENTINEL_BETA_0123456789abcdef";
const person = (id: string) => ({ licencieId: id, firstName: id, lastName: "Exemple", teamId: null });

function club(clubSlug: string, secret: string): ClubSession {
  return { clubSlug, clubName: clubSlug, accentColor: null, timezone: "Europe/Paris", secret, people: [person(`lic-${clubSlug}`)], activeLicencieId: `lic-${clubSlug}` };
}
const ALPHA = club("club-alpha", SENTINEL_ALPHA);
const BETA = club("club-beta", SENTINEL_BETA);
const stateOf = (...clubs: ClubSession[]): SessionState => ({ v: 1, active: clubs[0]!.clubSlug, clubs: Object.fromEntries(clubs.map((c) => [c.clubSlug, c])) });

type Reply = "ok" | "401" | "500" | "network";
let replies: Record<string, Reply>;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installNetwork(state: SessionState) {
  const fetchMock = async (request: Request) => {
    const { pathname } = new URL(request.url);
    const slug = /\/clubs\/([^/]+)/.exec(pathname)?.[1] ?? "";
    if (pathname.endsWith(`/clubs/${slug}`)) return json(200, { name: slug, accentColor: null, timezone: "Europe/Paris", logoUrl: null });
    const reply = replies[slug] ?? "ok";
    if (reply === "network") throw new TypeError("Network request failed");
    if (reply === "401") return json(401, { error: { code: "SESSION_INVALID", message: "Session expirée ou révoquée : reconnecte-toi." } });
    if (reply === "500") return json(500, { error: { code: "INTERNAL", message: "boom" } });
    return json(200, { people: state.clubs[slug]?.people ?? [] });
  };
  setApiClientForTests(createClient<paths>({ baseUrl: "https://api.test", fetch: fetchMock as unknown as typeof fetch }));
}

function Probe() {
  const { status, refusedClub } = useSession();
  return (
    <>
      <Text testID="status">{status}</Text>
      <Text testID="refused">{String(refusedClub ?? "")}</Text>
    </>
  );
}

async function mount(state: SessionState, bootReplies: Record<string, Reply> = {}, raw?: string) {
  await storage.set(SESSION_KEY, raw ?? JSON.stringify(state));
  replies = bootReplies;
  installNetwork(state);
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <Probe />
          <RefusedSessionRedirect />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(["AUTHENTICATED", "EXPIRED", "UNAUTHENTICATED"]).toContain(screen.getByTestId("status").props.children));
  // Laisse la revalidation du démarrage se terminer.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const status = () => screen.getByTestId("status").props.children as string;
const refused = () => screen.getByTestId("refused").props.children as string;
const stored = () => parseState(storage.dump()[SESSION_KEY] ?? null);
const storedText = () => Object.values(storage.dump()).join("\n");

beforeEach(async () => {
  replace.mockClear();
  clearPendingDestination();
  for (const key of Object.keys(storage.dump())) await storage.remove(key);
});
afterEach(() => setApiClientForTests(null));

describe("session refusée par le back (401 SESSION_INVALID) — plusieurs clubs", () => {
  it("au lancement : renvoie vers l'identification de club-beta, club-alpha reste connecté", async () => {
    await mount(stateOf(ALPHA, BETA), { "club-beta": "401" });
    expect(status()).toBe("AUTHENTICATED");
    expect(refused()).toBe("club-beta");
    expect(replace).toHaveBeenCalledWith("/connexion/club-beta");
    expect(replace).not.toHaveBeenCalledWith("/bienvenue");
    expect(replace).not.toHaveBeenCalledWith("/session-expiree");
  });

  it("au lancement : le stockage garde SENTINEL_ALPHA intacte et retire club-beta", async () => {
    await mount(stateOf(ALPHA, BETA), { "club-beta": "401" });
    expect(stored().clubs["club-alpha"]?.secret).toBe(SENTINEL_ALPHA);
    expect(stored().clubs["club-beta"]).toBeUndefined();
    expect(storedText()).not.toContain("SENTINEL_BETA");
  });

  it("en cours d'usage : un appel de club-beta refusé → identification de club-beta, club-alpha intact", async () => {
    await mount(stateOf(ALPHA, BETA));
    expect(replace).not.toHaveBeenCalled();
    replies = { "club-beta": "401" };
    await act(async () => {
      await authApi.addPeople("club-beta", SENTINEL_BETA, ["x"]).catch(() => undefined);
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/connexion/club-beta"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(stored().clubs["club-alpha"]?.secret).toBe(SENTINEL_ALPHA);
    expect(storedText()).not.toContain("SENTINEL_BETA");
  });

  it("le format stocké reste celui d'avant (mêmes clés, même version)", async () => {
    await mount(stateOf(ALPHA, BETA), { "club-beta": "401" });
    const raw = JSON.parse(storage.dump()[SESSION_KEY]!) as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(["active", "clubs", "v"]);
    expect(raw.v).toBe(1);
  });
});

describe("session refusée — un seul club", () => {
  it("club unique refusé : statut EXPIRED, club mémorisé, le garde envoie vers CE club (pas la liste)", async () => {
    await mount(stateOf(BETA), { "club-beta": "401" });
    expect(status()).toBe("EXPIRED");
    expect(refused()).toBe("club-beta");
    expect(storage.dump()[SESSION_KEY]).toBeUndefined();
    const decision = authGuard({ signedIn: false, status: "EXPIRED", pathname: "/", params: {}, refusedClub: "club-beta" });
    expect(decision?.redirect).toBe("/connexion/club-beta");
  });

  it("sans club refusé connu, le garde garde l'écran « session expirée » (comportement actuel figé)", () => {
    expect(authGuard({ signedIn: false, status: "EXPIRED", pathname: "/", params: {} })?.redirect).toBe("/session-expiree");
    expect(authGuard({ signedIn: false, status: "UNAUTHENTICATED", pathname: "/", params: {} })?.redirect).toBe("/bienvenue");
  });
});

describe("erreur réseau ou 5xx — aucune session n'est touchée", () => {
  it.each<Reply>(["500", "network"])("au lancement, club-beta en %s : rien d'effacé, aucune redirection", async (reply) => {
    await mount(stateOf(ALPHA, BETA), { "club-beta": reply });
    expect(status()).toBe("AUTHENTICATED");
    expect(refused()).toBe("");
    expect(replace).not.toHaveBeenCalled();
    expect(stored().clubs["club-alpha"]?.secret).toBe(SENTINEL_ALPHA);
    expect(stored().clubs["club-beta"]?.secret).toBe(SENTINEL_BETA);
  });

  it("en cours d'usage, 500 sur club-beta : rien d'effacé, aucune redirection", async () => {
    await mount(stateOf(ALPHA, BETA));
    replies = { "club-beta": "500" };
    await act(async () => {
      await authApi.addPeople("club-beta", SENTINEL_BETA, ["x"]).catch(() => undefined);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(stored().clubs["club-beta"]?.secret).toBe(SENTINEL_BETA);
  });
});

describe("non-régression du stockage", () => {
  it("une session écrite dans l'ancien format (sans champ ajouté depuis) est relue correctement", async () => {
    const legacy = JSON.stringify({
      v: 1,
      active: "club-alpha",
      clubs: { "club-alpha": { clubSlug: "club-alpha", clubName: "Alpha", secret: SENTINEL_ALPHA, people: [person("lic-a")], activeLicencieId: "lic-a" } },
    });
    await mount(stateOf(ALPHA), {}, legacy);
    expect(status()).toBe("AUTHENTICATED");
    expect(refused()).toBe("");
    expect(stored().clubs["club-alpha"]?.secret).toBe(SENTINEL_ALPHA);
    expect(stored().clubs["club-alpha"]?.timezone).toBe("Europe/Paris");
  });
});
