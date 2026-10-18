import { Text } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import createClient from "openapi-fetch";
import type { paths } from "@/api/generated/schema";
import { setApiClientForTests } from "@/api/client";
import { SessionProvider, useSession } from "@/auth/SessionProvider";
import { SESSION_KEY } from "@/auth/session-repository";
import { serializeState, type ClubSession, type SessionState } from "@/auth/session-model";
import { clearAccountDeletedNotice } from "@/auth/account-deleted-notice";
import { peekPendingDestination, setPendingDestination } from "@/linking/pendingDestination";
import { AccountDeletedBanner } from "./AccountDeletedBanner";
import { DeleteAccountSection } from "./DeleteAccountSection";

// Aucun appel réseau réel : `fetch` est simulé, la vraie route de suppression n'est JAMAIS appelée.
jest.mock("expo-notifications", () => ({}));
jest.mock("@/auth/secure-storage", () => {
  const actual = jest.requireActual("@/auth/secure-storage");
  return { ...actual, secureStorage: actual.memoryStorage() };
});

const storage = (jest.requireMock("@/auth/secure-storage") as { secureStorage: { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void>; remove(k: string): Promise<void>; dump(): Record<string, string> } }).secureStorage;

const SENTINEL_A = "bmd_sentinelle_a_0123456789abcdef";
const SENTINEL_B = "bmd_sentinelle_b_0123456789abcdef";
const LEA = { licencieId: "lic-lea", firstName: "Léa", lastName: "Exemple", teamId: null };
const TOM = { licencieId: "lic-tom", firstName: "Tom", lastName: "Exemple", teamId: null };

function club(clubSlug: string, clubName: string, secret: string, people: ClubSession["people"]): ClubSession {
  return { clubSlug, clubName, accentColor: null, timezone: "Europe/Paris", secret, people, activeLicencieId: people[0]!.licencieId };
}
const CLUB_A = club("club-a", "Club A", SENTINEL_A, [LEA]);
const CLUB_B = club("club-b", "Club B", SENTINEL_B, [TOM]);
const stateOf = (...clubs: ClubSession[]): SessionState => ({ v: 1, active: clubs[0]!.clubSlug, clubs: Object.fromEntries(clubs.map((c) => [c.clubSlug, c])) });

type Reply = "204" | "401" | "500" | "network";
let deleteReplies: Record<string, Reply[]>;
let log: string[];
let statuses: string[];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function installNetwork(state: SessionState) {
  const fetchMock = async (request: Request) => {
    const { pathname } = new URL(request.url);
    log.push(`${request.method} ${pathname}`);
    const slug = /\/clubs\/([^/]+)/.exec(pathname)?.[1] ?? "";
    if (request.method === "DELETE" && pathname.endsWith("/auth/me")) {
      const reply = deleteReplies[slug]?.shift() ?? "204";
      if (reply === "network") throw new TypeError("Network request failed");
      if (reply === "204") return new Response(null, { status: 204 });
      return json(Number(reply), { error: { code: reply === "401" ? "SESSION_INVALID" : "INTERNAL", message: "x" } });
    }
    if (request.method === "GET" && pathname.endsWith("/auth/session")) return json(200, { people: state.clubs[slug]?.people ?? [] });
    return json(404, { error: { code: "NOT_FOUND", message: "x" } });
  };
  setApiClientForTests(createClient<paths>({ baseUrl: "https://api.test", fetch: fetchMock as unknown as typeof fetch }));
}

function Probe() {
  const { status } = useSession();
  statuses.push(status);
  return <Text testID="status">{status}</Text>;
}

async function mount(state: SessionState) {
  await storage.set(SESSION_KEY, serializeState(state));
  installNetwork(state);
  const queryClient = new QueryClient();
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <Probe />
          <AccountDeletedBanner />
          <DeleteAccountSection />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
  // Démarrage terminé (restauration + revalidation en arrière-plan) avant d'observer quoi que ce soit.
  await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("AUTHENTICATED"));
  log.length = 0;
  statuses.length = 0;
}

const deleteCalls = () => log.filter((l) => l.startsWith("DELETE"));
const stored = () => Object.values(storage.dump()).join("\n");

async function openConfirmation() {
  await fireEvent.press(screen.getByRole("button", { name: "Supprimer mon compte" }));
}
async function confirm() {
  await fireEvent.press(screen.getByRole("button", { name: "Supprimer définitivement" }));
}

beforeEach(async () => {
  deleteReplies = {};
  log = [];
  statuses = [];
  clearAccountDeletedNotice();
  setPendingDestination(null);
  for (const key of Object.keys(storage.dump())) await storage.remove(key);
});
afterEach(() => setApiClientForTests(null));

describe("Supprimer mon compte — confirmation", () => {
  it("sans confirmation : ouvre la confirmation (clubs, prénoms, supprimé / conservé) et n'appelle rien", async () => {
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    expect(screen.getByText("Club A")).toBeTruthy();
    expect(screen.getByText("Léa")).toBeTruthy();
    expect(screen.getByText("Club B")).toBeTruthy();
    expect(screen.getByText("Tom")).toBeTruthy();
    expect(screen.getByText(/Supprimé/)).toBeTruthy();
    expect(screen.getByText(/Conservé/)).toBeTruthy();
    expect(screen.getByText(/autre parent/i)).toBeTruthy();
    expect(log).toEqual([]);
    expect(stored()).toContain(SENTINEL_A);
  });

  it("annulation : aucun appel, la session est toujours là", async () => {
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    await fireEvent.press(screen.getByRole("button", { name: "Annuler" }));
    expect(log).toEqual([]);
    expect(stored()).toContain(SENTINEL_A);
    expect(stored()).toContain(SENTINEL_B);
  });
});

describe("Supprimer mon compte — exécution (un club par un, dans l'ordre)", () => {
  it("deux clubs en 204 : 2 appels dans l'ordre, plus aucune sentinelle, retour à l'accueil avec le message", async () => {
    setPendingDestination({ clubSlug: "club-a", route: "/c/club-a/planning" });
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    await confirm();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("UNAUTHENTICATED"));
    expect(deleteCalls()).toEqual(["DELETE /v1/public/clubs/club-a/auth/me", "DELETE /v1/public/clubs/club-b/auth/me"]);
    expect(stored()).not.toContain("bmd_sentinelle");
    expect(screen.getByText("Ton compte a été supprimé.")).toBeTruthy();
    expect(peekPendingDestination()).toBeNull();
  });

  it("après un 204 : aucun autre appel réseau (ni DELETE /auth/session, ni push)", async () => {
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    await confirm();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("UNAUTHENTICATED"));
    expect(log).toHaveLength(2);
    expect(log.every((l) => l.endsWith("/auth/me"))).toBe(true);
  });

  it("club-a en 204, club-b en 500 : A disparaît, B reste, l'app reste connectée, le message nomme B, le nouvel essai ne vise que B", async () => {
    deleteReplies = { "club-b": ["500", "204"] };
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    await confirm();
    await waitFor(() => expect(screen.getByText(/n'a pas pu être supprimé/)).toBeTruthy());
    expect(screen.getByText(/pour : Club B\./)).toBeTruthy();
    expect(screen.queryByText("Club A")).toBeNull();
    expect(stored()).not.toContain(SENTINEL_A);
    expect(stored()).toContain(SENTINEL_B);
    expect(screen.getByTestId("status").props.children).toBe("AUTHENTICATED");
    expect(screen.getByText(/n'a pas pu être supprimé/)).toBeTruthy();
    expect(screen.queryByText("Ton compte a été supprimé.")).toBeNull();

    log.length = 0;
    await confirm();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("UNAUTHENTICATED"));
    expect(deleteCalls()).toEqual(["DELETE /v1/public/clubs/club-b/auth/me"]);
    expect(stored()).not.toContain("bmd_sentinelle");
  });

  it("erreur réseau : la session reste, un message s'affiche, le bouton est de nouveau actif", async () => {
    deleteReplies = { "club-a": ["network"] };
    await mount(stateOf(CLUB_A));
    await openConfirmation();
    await confirm();
    await waitFor(() => expect(screen.getByText(/n'a pas pu être supprimé/)).toBeTruthy());
    expect(stored()).toContain(SENTINEL_A);
    expect(screen.getByRole("button", { name: "Supprimer définitivement" }).props.accessibilityState.disabled).toBe(false);
  });

  it("500 sur l'unique club : même chose, session conservée", async () => {
    deleteReplies = { "club-a": ["500"] };
    await mount(stateOf(CLUB_A));
    await openConfirmation();
    await confirm();
    await waitFor(() => expect(screen.getByText(/n'a pas pu être supprimé/)).toBeTruthy());
    expect(stored()).toContain(SENTINEL_A);
    expect(screen.getByTestId("status").props.children).toBe("AUTHENTICATED");
  });

  it("club-a en 401 : même nettoyage qu'un 204, sans passer par EXPIRED ni double navigation", async () => {
    deleteReplies = { "club-a": ["401"] };
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    await confirm();
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("UNAUTHENTICATED"));
    expect(stored()).not.toContain("bmd_sentinelle");
    expect(statuses).not.toContain("EXPIRED");
    expect(screen.getByText("Ton compte a été supprimé.")).toBeTruthy();
    expect(deleteCalls()).toHaveLength(2);
  });

  it("double appui : la séquence ne part qu'une fois", async () => {
    await mount(stateOf(CLUB_A, CLUB_B));
    await openConfirmation();
    const button = screen.getByRole("button", { name: "Supprimer définitivement" });
    // Deux appuis dans le même tick, avant tout rendu : seul le garde de la séquence peut l'empêcher.
    await act(async () => {
      button.props.onClick();
      button.props.onClick();
    });
    await waitFor(() => expect(screen.getByTestId("status").props.children).toBe("UNAUTHENTICATED"));
    expect(deleteCalls()).toHaveLength(2);
  });
});
