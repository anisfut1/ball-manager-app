import { useEffect } from "react";
import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import createClient from "openapi-fetch";
import type { paths } from "@/api/generated/schema";
import { setApiClientForTests } from "@/api/client";
import { clearPendingDestination } from "@/linking/pendingDestination";
import { SessionProvider, useSession, type SessionContextValue } from "./SessionProvider";
import { parseState, type ClubSession, type SessionState } from "./session-model";
import { SESSION_KEY } from "./session-repository";
import { REFUSED_CLUBS_KEY, parseRefusedClubs, refusalReducer, type RefusalState } from "./refused-clubs";

jest.mock("expo-notifications", () => ({}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock("@/auth/secure-storage", () => {
  const actual = jest.requireActual("@/auth/secure-storage");
  return { ...actual, secureStorage: actual.memoryStorage() };
});

const storage = (jest.requireMock("@/auth/secure-storage") as { secureStorage: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void>; dump(): Record<string, string> } }).secureStorage;

const SENTINEL_ALPHA = "bmd_SENTINEL_ALPHA_0123456789abcdef";
const SENTINEL_BETA = "bmd_SENTINEL_BETA_0123456789abcdef";
const SENTINEL_GAMMA = "bmd_SENTINEL_GAMMA_0123456789abcdef";
const person = (id: string) => ({ licencieId: id, firstName: id, lastName: "Exemple", teamId: null });
const club = (clubSlug: string, clubName: string, secret: string): ClubSession => ({ clubSlug, clubName, accentColor: null, timezone: "Europe/Paris", secret, people: [person(`lic-${clubSlug}`)], activeLicencieId: `lic-${clubSlug}` });
const ALPHA = club("club-alpha", "Alpha BC", SENTINEL_ALPHA);
const BETA = club("club-beta", "Beta BC", SENTINEL_BETA);
const GAMMA = club("club-gamma", "Gamma BC", SENTINEL_GAMMA);
const stateOf = (...clubs: ClubSession[]): SessionState => ({ v: 1, active: clubs[0]!.clubSlug, clubs: Object.fromEntries(clubs.map((c) => [c.clubSlug, c])) });

let refusedSlugs: string[];
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installNetwork(state: SessionState) {
  const fetchMock = async (request: Request) => {
    const { pathname } = new URL(request.url);
    const slug = /\/clubs\/([^/]+)/.exec(pathname)?.[1] ?? "";
    if (request.method === "POST" && pathname.endsWith("/auth/device-sessions")) {
      return json(201, { sessionSecret: `bmd_NEW_${slug}_0123456789abcdef`, expiresAt: "2027-01-01T00:00:00Z", people: [person(`lic-${slug}`)], redirectPath: null });
    }
    if (pathname.endsWith(`/clubs/${slug}`)) return json(200, { name: slug, accentColor: null, timezone: "Europe/Paris", logoUrl: null });
    if (refusedSlugs.includes(slug)) return json(401, { error: { code: "SESSION_INVALID", message: "Session expirée ou révoquée : reconnecte-toi." } });
    return json(200, { people: state.clubs[slug]?.people ?? [] });
  };
  setApiClientForTests(createClient<paths>({ baseUrl: "https://api.test", fetch: fetchMock as unknown as typeof fetch }));
}

let session: SessionContextValue;
function Probe() {
  const current = useSession();
  useEffect(() => {
    session = current;
  });
  return <Text testID="refused">{current.refusedClubs.map((c) => c.clubSlug).join(",")}</Text>;
}

async function mount(state: SessionState | null) {
  if (state) await storage.set(SESSION_KEY, JSON.stringify(state));
  installNetwork(state ?? stateOf(ALPHA));
  const view = await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <Probe />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(["AUTHENTICATED", "EXPIRED", "UNAUTHENTICATED"]).toContain(session.status));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  return view;
}

const listed = () => screen.getByTestId("refused").props.children as string;
const sessions = () => parseState(storage.dump()[SESSION_KEY] ?? null);

beforeEach(async () => {
  refusedSlugs = [];
  clearPendingDestination();
  for (const key of Object.keys(storage.dump())) await storage.remove(key);
});
afterEach(() => setApiClientForTests(null));

describe("liste des clubs refusés", () => {
  it("B et C refusés au même lancement : les deux sont dans la liste, A reste intact", async () => {
    refusedSlugs = ["club-beta", "club-gamma"];
    await mount(stateOf(ALPHA, BETA, GAMMA));
    expect(listed()).toBe("club-beta,club-gamma");
    expect(session.refusedClubs.map((c) => c.clubName)).toEqual(["Beta BC", "Gamma BC"]);
    expect(sessions().clubs["club-alpha"]?.secret).toBe(SENTINEL_ALPHA);
    expect(Object.keys(sessions().clubs)).toEqual(["club-alpha"]);
  });

  it("la liste est persistée dans une clé séparée et relue après un redémarrage", async () => {
    refusedSlugs = ["club-beta", "club-gamma"];
    const first = await mount(stateOf(ALPHA, BETA, GAMMA));
    expect(storage.dump()[REFUSED_CLUBS_KEY]).toBeDefined();
    await first.unmount();
    refusedSlugs = [];
    await mount(null);
    expect(listed()).toBe("club-beta,club-gamma");
    expect(session.refusedClubs.map((c) => c.clubName)).toEqual(["Beta BC", "Gamma BC"]);
  });

  it("la clé séparée ne contient aucun secret (slug et nom seulement)", async () => {
    refusedSlugs = ["club-beta", "club-gamma"];
    await mount(stateOf(ALPHA, BETA, GAMMA));
    const raw = storage.dump()[REFUSED_CLUBS_KEY]!;
    expect(raw).not.toContain("bmd_");
    expect(raw).not.toContain("SENTINEL_BETA");
    expect(raw).not.toContain("SENTINEL_GAMMA");
    expect(raw).not.toContain("SENTINEL_ALPHA");
    expect(JSON.parse(raw)).toEqual({ v: 1, clubs: [{ clubSlug: "club-beta", clubName: "Beta BC" }, { clubSlug: "club-gamma", clubName: "Gamma BC" }] });
  });

  it("identification réussie sur B : B quitte la liste, C reste (et le stockage suit)", async () => {
    refusedSlugs = ["club-beta", "club-gamma"];
    await mount(stateOf(ALPHA, BETA, GAMMA));
    refusedSlugs = [];
    await act(async () => {
      await session.bootstrapFromToken("club-beta", "jeton-personnel-1234");
    });
    await waitFor(() => expect(listed()).toBe("club-gamma"));
    expect(JSON.parse(storage.dump()[REFUSED_CLUBS_KEY]!).clubs).toEqual([{ clubSlug: "club-gamma", clubName: "Gamma BC" }]);
    expect(sessions().clubs["club-beta"]).toBeDefined();
  });

  it("fermer l'avis de C : C quitte la liste, B reste (et le stockage suit)", async () => {
    refusedSlugs = ["club-beta", "club-gamma"];
    await mount(stateOf(ALPHA, BETA, GAMMA));
    await act(async () => session.dismissRefusal("club-gamma"));
    await waitFor(() => expect(listed()).toBe("club-beta"));
    expect(JSON.parse(storage.dump()[REFUSED_CLUBS_KEY]!).clubs).toEqual([{ clubSlug: "club-beta", clubName: "Beta BC" }]);
  });

  it("le même club refusé par deux chemins (revalidation + appel) : une seule entrée", async () => {
    refusedSlugs = ["club-beta"];
    await mount(stateOf(ALPHA, BETA));
    expect(session.refusedClubs).toHaveLength(1);
    expect(refusalReducer({ clubs: [{ clubSlug: "club-beta", clubName: "Beta BC" }] } as RefusalState, { type: "REFUSED", clubs: [{ clubSlug: "club-beta", clubName: "Beta BC" }] }).clubs).toHaveLength(1);
  });

  it("erreur réseau ou 5xx : aucun club ajouté à la liste", async () => {
    await mount(stateOf(ALPHA, BETA));
    expect(listed()).toBe("");
    expect(storage.dump()[REFUSED_CLUBS_KEY]).toBeUndefined();
  });

  it("clé illisible : liste vide, aucun plantage", () => {
    expect(parseRefusedClubs("pas du json")).toEqual([]);
    expect(parseRefusedClubs(JSON.stringify({ v: 2, clubs: [] }))).toEqual([]);
    expect(parseRefusedClubs(null)).toEqual([]);
  });

  it("non-régression : bm.sessions.v1 écrit dans l'ancien format est relu", async () => {
    const legacy = JSON.stringify({ v: 1, active: "club-alpha", clubs: { "club-alpha": { clubSlug: "club-alpha", clubName: "Alpha BC", secret: SENTINEL_ALPHA, people: [person("lic-a")], activeLicencieId: "lic-a" } } });
    await storage.set(SESSION_KEY, legacy);
    await mount(null);
    expect(session.status).toBe("AUTHENTICATED");
    expect(sessions().clubs["club-alpha"]?.secret).toBe(SENTINEL_ALPHA);
  });
});
