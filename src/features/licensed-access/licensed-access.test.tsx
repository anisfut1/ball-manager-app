import { fireEvent, render, screen } from "@testing-library/react-native";
import { ApiError } from "@/api/errors";
import { LicensedAccessGate } from "./LicensedAccessGate";
import { LicensedSearchCard } from "./LicensedSearchCard";
import { moduleForRoute } from "./modules";

// Aucun appel réseau : l'API d'identification est simulée.
jest.mock("@/api/endpoints/identify", () => ({ identifyApi: { search: jest.fn(), requestLink: jest.fn(), accessRequest: jest.fn() } }));
const identifyApi = (jest.requireMock("@/api/endpoints/identify") as { identifyApi: { search: jest.Mock; requestLink: jest.Mock } }).identifyApi;

// Compte et session simulés (aucun trousseau, aucun réseau).
const mockSession = { state: { v: 1, active: null, clubs: {} as Record<string, unknown> }, accountLogin: jest.fn(), accountToken: jest.fn(), refresh: jest.fn() };
jest.mock("@/auth/SessionProvider", () => ({ useSession: () => mockSession }));
jest.mock("@/api/endpoints/account", () => ({ accountApi: { signUp: jest.fn(), verify: jest.fn(), signIn: jest.fn(), resendCode: jest.fn(), passwordReset: jest.fn(), link: jest.fn() } }));
const accountApi = (jest.requireMock("@/api/endpoints/account") as { accountApi: Record<string, jest.Mock> }).accountApi;
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
const mockRouter = (jest.requireMock("expo-router") as { router: { replace: jest.Mock } }).router;

const LEA = { id: "11111111-1111-4111-8111-111111111111", firstName: "Léa", lastInitial: "M" };

beforeEach(() => {
  identifyApi.search.mockReset();
  identifyApi.requestLink.mockReset();
  Object.values(accountApi).forEach((m) => m.mockReset());
  mockSession.accountLogin.mockReset();
  mockRouter.replace.mockReset();
});

describe("LicensedSearchCard", () => {
  it("n'interroge pas le serveur avec un seul mot", async () => {
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Léa");
    expect(identifyApi.search).not.toHaveBeenCalled();
  });

  it("trouve le licencié, crée le compte avec le code reçu, le rattache et ouvre le club", async () => {
    identifyApi.search.mockResolvedValue([LEA]);
    accountApi.signUp!.mockResolvedValue({ sent: true });
    const dto = { accessToken: "a.b.c", refreshToken: "r", expiresAt: "2030-01-01T00:00:00Z", user: { id: "u1", email: "parent@example.test" } };
    accountApi.verify!.mockResolvedValue(dto);
    accountApi.link!.mockResolvedValue({ status: "active" });
    mockSession.accountLogin.mockResolvedValue({ active: 1, pending: 0 });
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Martin Léa");
    await fireEvent.press(await screen.findByLabelText("Léa M., c'est moi", {}, { timeout: 2000 }));
    await fireEvent.changeText(screen.getByLabelText("Adresse email"), "parent@example.test");
    await fireEvent.changeText(screen.getByLabelText("Mot de passe"), "motdepasse1");
    await fireEvent.press(screen.getByLabelText("Créer mon compte"));
    await fireEvent.changeText(await screen.findByLabelText("Code reçu par email"), "123456");
    await fireEvent.press(screen.getByLabelText("Valider le code"));
    await screen.findByLabelText("Valider le code");
    expect(accountApi.verify).toHaveBeenCalledWith("parent@example.test", "123456", "motdepasse1");
    expect(accountApi.link).toHaveBeenCalledWith("club-demo", "a.b.c", LEA.id);
    expect(mockSession.accountLogin).toHaveBeenCalledWith("club-demo", dto);
    expect(mockRouter.replace).toHaveBeenCalled();
  });

  it("adresse inconnue du club : demande en attente de validation", async () => {
    identifyApi.search.mockResolvedValue([LEA]);
    accountApi.signIn!.mockResolvedValue({ accessToken: "a.b.c", refreshToken: "r", expiresAt: "2030-01-01T00:00:00Z", user: { id: "u1", email: "pere@example.test" } });
    accountApi.link!.mockResolvedValue({ status: "pending" });
    mockSession.accountLogin.mockResolvedValue({ active: 0, pending: 1 });
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Martin Léa");
    await fireEvent.press(await screen.findByLabelText("Léa M., c'est moi", {}, { timeout: 2000 }));
    await fireEvent.press(screen.getByText("J'ai un compte"));
    await fireEvent.changeText(screen.getByLabelText("Adresse email"), "pere@example.test");
    await fireEvent.changeText(screen.getByLabelText("Mot de passe"), "motdepasse1");
    await fireEvent.press(screen.getByLabelText("Se connecter"));
    expect(await screen.findByText("Demande transmise au club")).toBeTruthy();
  });

  it("aucun licencié : état dédié", async () => {
    identifyApi.search.mockResolvedValue([]);
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Personne Inconnue");
    expect(await screen.findByText("Aucun licencié trouvé", {}, { timeout: 2000 })).toBeTruthy();
  });

  it("panne : message neutre puis « Réessayer »", async () => {
    identifyApi.search.mockRejectedValueOnce(new ApiError("server", "stack trace interne", 500, "INTERNAL")).mockResolvedValueOnce([LEA]);
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Léa Martin");
    expect(await screen.findByText("Impossible d'effectuer la recherche pour le moment.", {}, { timeout: 2000 })).toBeTruthy();
    expect(screen.queryByText("stack trace interne")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Réessayer"));
    expect(await screen.findByLabelText("Léa M., c'est moi", {}, { timeout: 2000 })).toBeTruthy();
  });
});

describe("LicensedAccessGate", () => {
  it.each([
    ["tables", "Tables de marque"],
    ["team", "Mon équipe"],
    ["derogations", "Dérogations"],
  ] as const)("module %s : accès réservé, club et titre", async (module, title) => {
    await render(<LicensedAccessGate module={module} clubSlug="club-demo" clubName="Club Démo" logoUrl={null} />);
    expect(screen.getByText("Accès réservé aux licenciés")).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText("Club Démo")).toBeTruthy();
  });

  it("choisit le module d'après la page demandée avant la connexion", () => {
    expect(moduleForRoute("/tables")).toBe("tables");
    expect(moduleForRoute("/c/club-demo/derogations/abc")).toBe("derogations");
    expect(moduleForRoute("/equipe")).toBe("team");
    expect(moduleForRoute(null)).toBe("home");
  });
});
