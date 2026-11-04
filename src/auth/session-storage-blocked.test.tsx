import { AppState, Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import createClient from "openapi-fetch";
import type { paths } from "@/api/generated/schema";
import { setApiClientForTests } from "@/api/client";
import { clearPendingDestination } from "@/linking/pendingDestination";
import { SessionProvider, useSession } from "./SessionProvider";
import { parseState, type ClubSession, type SessionState } from "./session-model";
import { SESSION_KEY } from "./session-repository";
import { SessionStorageUnavailableError } from "./storage-errors";

/**
 * A2 (audit sécurité 2026-11) : si le trousseau est illisible au démarrage (appareil verrouillé…), l'app
 * ne doit JAMAIS prendre « illisible » pour « aucune session » : un lien personnel ouvert à ce moment
 * écraserait les sessions des autres clubs. Elle doit refuser d'écrire, puis RÉCUPÉRER au retour au premier plan.
 */
jest.mock("expo-notifications", () => ({}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock("@/auth/secure-storage", () => {
  const actual = jest.requireActual("@/auth/secure-storage");
  return { ...actual, secureStorage: actual.memoryStorage() };
});

type Store = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void>; dump(): Record<string, string> };
const storage = (jest.requireMock("@/auth/secure-storage") as { secureStorage: Store }).secureStorage;

const person = (id: string) => ({ licencieId: id, firstName: id, lastName: "Exemple", teamId: null });
const club = (slug: string, secret: string): ClubSession => ({ clubSlug: slug, clubName: slug, accentColor: null, timezone: "Europe/Paris", secret, people: [person(`lic-${slug}`)], activeLicencieId: `lic-${slug}` });
const ALPHA = club("club-alpha", "bmd_SENTINEL_ALPHA_0123456789abcdef");
const BETA = club("club-beta", "bmd_SENTINEL_BETA_0123456789abcdef");
const GAMMA_SESSION_VALUE = "bmd_SENTINEL_GAMMA_0123456789abcdef";
const stateOf = (...clubs: ClubSession[]): SessionState => ({ v: 1, active: clubs[0]!.clubSlug, clubs: Object.fromEntries(clubs.map((c) => [c.clubSlug, c])) });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installNetwork(state: SessionState) {
  const fetchMock = async (request: Request) => {
    const { pathname } = new URL(request.url);
    const slug = /\/clubs\/([^/]+)/.exec(pathname)?.[1] ?? "";
    if (pathname.endsWith("/auth/device-sessions")) return json(201, { sessionSecret: GAMMA_SESSION_VALUE, expiresAt: "2027-01-01T00:00:00Z", people: [person("lic-club-gamma")], redirectPath: null });
    if (pathname.endsWith(`/clubs/${slug}`)) return json(200, { name: slug, accentColor: null, timezone: "Europe/Paris", logoUrl: null });
    return json(200, { people: state.clubs[slug]?.people ?? [person(`lic-${slug}`)] });
  };
  setApiClientForTests(createClient<paths>({ baseUrl: "https://api.test", fetch: fetchMock as unknown as typeof fetch }));
}

// Dernière valeur de useSession(), exposée aux tests (affectée dans un effet, jamais pendant le rendu).
const latest: { current: ReturnType<typeof useSession> | null } = { current: null };
const session = () => latest.current!;
function Probe() {
  const value = useSession();
  useEffect(() => {
    latest.current = value;
  });
  return (
    <>
      <Text testID="status">{value.status}</Text>
      <Text testID="clubs">{Object.keys(value.state.clubs).join(",")}</Text>
    </>
  );
}

let appStateHandler: ((s: string) => void) | null;

async function mount(state: SessionState) {
  await storage.set(SESSION_KEY, JSON.stringify(state));
  installNetwork(state);
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <Probe />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(["AUTHENTICATED", "UNAUTHENTICATED"]).toContain(screen.getByTestId("status").props.children));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const status = () => screen.getByTestId("status").props.children as string;
const clubs = () => screen.getByTestId("clubs").props.children as string;
const stored = () => parseState(storage.dump()[SESSION_KEY] ?? null);
const unlock = async () => {
  await act(async () => {
    appStateHandler?.("active");
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

beforeEach(async () => {
  clearPendingDestination();
  appStateHandler = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_type: string, handler: (s: string) => void) => {
    appStateHandler = handler;
    return { remove: jest.fn() };
  }) as never);
  for (const key of Object.keys(storage.dump())) await storage.remove(key);
});
afterEach(() => {
  setApiClientForTests(null);
  jest.restoreAllMocks();
});

/** Fait échouer UNE lecture du trousseau (la lecture des sessions au démarrage). */
const failNextRead = () => jest.spyOn(storage, "get").mockRejectedValueOnce(new Error("errSecInteractionNotAllowed"));

describe("trousseau illisible au démarrage", () => {
  it("l'app démarre sans session, et le trousseau reste INTACT", async () => {
    failNextRead();
    await mount(stateOf(ALPHA, BETA));
    expect(status()).toBe("UNAUTHENTICATED");
    expect(Object.keys(stored().clubs)).toEqual(["club-alpha", "club-beta"]);
  });

  it("un lien personnel ouvert à ce moment est REFUSÉ et n'écrase aucune session", async () => {
    failNextRead();
    await mount(stateOf(ALPHA, BETA));
    await expect(session().bootstrapFromToken("club-gamma", "jeton-personnel-1234")).rejects.toBeInstanceOf(SessionStorageUnavailableError);
    expect(Object.keys(stored().clubs)).toEqual(["club-alpha", "club-beta"]);
    expect(stored().clubs["club-alpha"]?.secret).toBe(ALPHA.secret);
  });

  it("au retour au premier plan, les VRAIES sessions sont relues", async () => {
    failNextRead();
    await mount(stateOf(ALPHA, BETA));
    expect(clubs()).toBe("");
    await unlock();
    await waitFor(() => expect(status()).toBe("AUTHENTICATED"));
    expect(clubs()).toBe("club-alpha,club-beta");
    expect(Object.keys(stored().clubs)).toEqual(["club-alpha", "club-beta"]);
  });

  it("après récupération, un nouveau lien AJOUTE le club sans perdre les autres", async () => {
    failNextRead();
    await mount(stateOf(ALPHA, BETA));
    await unlock();
    await waitFor(() => expect(status()).toBe("AUTHENTICATED"));
    await act(async () => {
      await session().bootstrapFromToken("club-gamma", "jeton-personnel-1234");
    });
    expect(Object.keys(stored().clubs).sort()).toEqual(["club-alpha", "club-beta", "club-gamma"]);
    expect(stored().clubs["club-alpha"]?.secret).toBe(ALPHA.secret);
  });
});

describe("trousseau lisible (comportement normal inchangé)", () => {
  it("les sessions sont relues au démarrage, sans blocage", async () => {
    await mount(stateOf(ALPHA, BETA));
    expect(status()).toBe("AUTHENTICATED");
    expect(clubs()).toBe("club-alpha,club-beta");
  });

  it("aucune session stockée : non connecté, et un lien fonctionne", async () => {
    await mount(stateOf(ALPHA));
    await storage.remove(SESSION_KEY);
    await act(async () => {
      await session().bootstrapFromToken("club-gamma", "jeton-personnel-1234");
    });
    expect(Object.keys(stored().clubs)).toContain("club-gamma");
  });
});
