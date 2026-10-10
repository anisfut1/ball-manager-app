import { clearPendingDestination, setPendingDestination } from "@/linking/pendingDestination";
import { destinationAfterLogin } from "./after-login";

describe("destination après connexion", () => {
  afterEach(() => clearPendingDestination());
  it("destination d'origine en priorité (convocation ouverte déconnecté)", () => {
    setPendingDestination({ clubSlug: "a", route: "/c/a/matchs/m1?section=convocation" });
    expect(destinationAfterLogin("a", "/public/a/accueil")).toBe("/c/a/matchs/m1?section=convocation");
  });
  it("sinon la destination du lien de connexion (chemin web → écran de l'app)", () => {
    expect(destinationAfterLogin("a", "/public/a/derogations/r1")).toBe("/c/a/derogations/r1");
  });
  it("sinon l'accueil du club", () => {
    expect(destinationAfterLogin("a", null)).toBe("/c/a");
    expect(destinationAfterLogin("a", "https://evil.example/x")).toBe("/c/a");
  });
});
