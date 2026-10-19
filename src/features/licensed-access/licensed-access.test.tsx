import { fireEvent, render, screen } from "@testing-library/react-native";
import { ApiError } from "@/api/errors";
import { LicensedAccessGate } from "./LicensedAccessGate";
import { LicensedSearchCard } from "./LicensedSearchCard";
import { moduleForRoute } from "./modules";

// Aucun appel réseau : l'API d'identification est simulée.
jest.mock("@/api/endpoints/identify", () => ({ identifyApi: { search: jest.fn(), requestLink: jest.fn(), accessRequest: jest.fn() } }));
const identifyApi = (jest.requireMock("@/api/endpoints/identify") as { identifyApi: { search: jest.Mock; requestLink: jest.Mock } }).identifyApi;

const LEA = { id: "11111111-1111-4111-8111-111111111111", firstName: "Léa", lastInitial: "M" };

beforeEach(() => {
  identifyApi.search.mockReset();
  identifyApi.requestLink.mockReset();
});

describe("LicensedSearchCard", () => {
  it("n'interroge pas le serveur avec un seul mot", async () => {
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Léa");
    expect(identifyApi.search).not.toHaveBeenCalled();
  });

  it("trouve le licencié puis envoie le lien (adresse masquée)", async () => {
    identifyApi.search.mockResolvedValue([LEA]);
    identifyApi.requestLink.mockResolvedValue({ sent: true, maskedEmail: "l•••@gmail.com", pendingApproval: false });
    await render(<LicensedSearchCard clubSlug="club-demo" autoFocus={false} />);
    await fireEvent.changeText(screen.getByLabelText("Ton prénom et ton nom"), "Martin Léa");
    await fireEvent.press(await screen.findByLabelText("Léa M., c'est moi", {}, { timeout: 2000 }));
    expect(identifyApi.search).toHaveBeenCalledWith("club-demo", "Martin Léa");
    await fireEvent.press(screen.getByLabelText("Recevoir mon lien sécurisé"));
    expect(await screen.findByText("C'est envoyé, Léa !")).toBeTruthy();
    expect(identifyApi.requestLink).toHaveBeenCalledWith("club-demo", LEA.id, { email: null });
    expect(screen.getByText("l•••@gmail.com")).toBeTruthy();
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
