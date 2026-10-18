import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import createClient from "openapi-fetch";
import { router, usePathname } from "expo-router";
import type { paths } from "@/api/generated/schema";
import { setApiClientForTests } from "@/api/client";
import { SessionProvider, useSession } from "@/auth/SessionProvider";
import { REFUSED_CLUBS_KEY } from "@/auth/refused-clubs";
import { SESSION_KEY } from "@/auth/session-repository";
import { RefusedClubNotices } from "./RefusedClubNotices";
import { RefusedSessionRedirect } from "./RefusedSessionRedirect";
import type { ClubSession, SessionState } from "@/auth/session-model";

jest.mock("expo-notifications", () => ({}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() }, usePathname: jest.fn(() => "/") }));
jest.mock("@/auth/secure-storage", () => {
  const actual = jest.requireActual("@/auth/secure-storage");
  return { ...actual, secureStorage: actual.memoryStorage() };
});

const storage = (jest.requireMock("@/auth/secure-storage") as { secureStorage: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void>; dump(): Record<string, string> } }).secureStorage;
const replace = router.replace as jest.Mock;
const push = router.push as jest.Mock;
const pathname = usePathname as jest.Mock;

const person = (id: string) => ({ licencieId: id, firstName: id, lastName: "Exemple", teamId: null });
const club = (clubSlug: string, clubName: string): ClubSession => ({ clubSlug, clubName, accentColor: null, timezone: "Europe/Paris", secret: `bmd_SENTINEL_${clubSlug.toUpperCase()}_0123456789abcdef`, people: [person(`lic-${clubSlug}`)], activeLicencieId: `lic-${clubSlug}` });
const ALPHA = club("club-alpha", "Alpha BC");
const BETA = club("club-beta", "Beta BC");
const GAMMA = club("club-gamma", "Gamma BC");
const stateOf = (...clubs: ClubSession[]): SessionState => ({ v: 1, active: clubs[0]!.clubSlug, clubs: Object.fromEntries(clubs.map((c) => [c.clubSlug, c])) });

let replies: Record<string, "ok" | "401" | "500">;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function Screen() {
  const { status } = useSession();
  return <Text testID="screen">{`Écran du club actif (${status})`}</Text>;
}

async function mount(state: SessionState) {
  await storage.set(SESSION_KEY, JSON.stringify(state));
  const fetchMock = async (request: Request) => {
    const { pathname: path } = new URL(request.url);
    const slug = /\/clubs\/([^/]+)/.exec(path)?.[1] ?? "";
    if (path.endsWith(`/clubs/${slug}`)) return json(200, { name: slug, accentColor: null, timezone: "Europe/Paris", logoUrl: null });
    const reply = replies[slug] ?? "ok";
    if (reply === "401") return json(401, { error: { code: "SESSION_INVALID", message: "x" } });
    if (reply === "500") return json(500, { error: { code: "INTERNAL", message: "x" } });
    return json(200, { people: state.clubs[slug]?.people ?? [] });
  };
  setApiClientForTests(createClient<paths>({ baseUrl: "https://api.test", fetch: fetchMock as unknown as typeof fetch }));
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={new QueryClient()}>
        <SessionProvider>
          <Screen />
          <RefusedSessionRedirect />
          <RefusedClubNotices />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByTestId("screen").props.children).toMatch(/AUTHENTICATED|EXPIRED|UNAUTHENTICATED/));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

beforeEach(async () => {
  replies = {};
  replace.mockClear();
  push.mockClear();
  pathname.mockReturnValue("/");
  for (const key of Object.keys(storage.dump())) await storage.remove(key);
});
afterEach(() => setApiClientForTests(null));

describe("avis « session expirée » — non bloquant", () => {
  it("club actif = club-alpha, refus sur club-beta : l'avis est visible et la personne reste sur son écran", async () => {
    replies = { "club-beta": "401" };
    await mount(stateOf(ALPHA, BETA));
    expect(screen.getByText("Ta session Beta BC a expiré.")).toBeTruthy();
    expect(screen.getByTestId("screen").props.children).toBe("Écran du club actif (AUTHENTICATED)");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("presser « Se reconnecter » ouvre l'identification de club-beta", async () => {
    replies = { "club-beta": "401" };
    await mount(stateOf(ALPHA, BETA));
    await fireEvent.press(screen.getByRole("button", { name: "Se reconnecter" }));
    expect(push).toHaveBeenCalledWith("/connexion/club-beta");
  });

  it("un avis par club refusé, chacun avec son propre bouton", async () => {
    replies = { "club-beta": "401", "club-gamma": "401" };
    await mount(stateOf(ALPHA, BETA, GAMMA));
    expect(screen.getByText("Ta session Beta BC a expiré.")).toBeTruthy();
    expect(screen.getByText("Ta session Gamma BC a expiré.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Se reconnecter" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Fermer" })).toHaveLength(2);
  });

  it("fermer l'avis (accessibilityLabel « Fermer ») le retire pour de bon, y compris du stockage", async () => {
    replies = { "club-beta": "401" };
    await mount(stateOf(ALPHA, BETA));
    await fireEvent.press(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByText("Ta session Beta BC a expiré.")).toBeNull();
    await waitFor(() => expect(storage.dump()[REFUSED_CLUBS_KEY]).toBeUndefined());
  });

  it("sur l'écran d'identification de ce club, son avis n'est pas répété", async () => {
    replies = { "club-beta": "401", "club-gamma": "401" };
    pathname.mockReturnValue("/connexion/club-beta");
    await mount(stateOf(ALPHA, BETA, GAMMA));
    expect(screen.queryByText("Ta session Beta BC a expiré.")).toBeNull();
    expect(screen.getByText("Ta session Gamma BC a expiré.")).toBeTruthy();
  });

  it("erreur 5xx : ni avis ni navigation", async () => {
    replies = { "club-beta": "500" };
    await mount(stateOf(ALPHA, BETA));
    expect(screen.queryByText(/a expiré/)).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
