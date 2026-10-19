import { memoryStorage } from "@/auth/secure-storage";
import { createDefaultClubRepository, DEFAULT_CLUB_KEY, parseDefaultClub } from "./default-club";

describe("club par défaut", () => {
  it("mémorise le club choisi et le relit au lancement suivant", async () => {
    const storage = memoryStorage();
    const repository = createDefaultClubRepository(storage);
    await repository.save({ slug: "club-demo", name: "Club Démo", logoUrl: null, accentColor: "#123456", timezone: "Europe/Paris" });
    expect(await createDefaultClubRepository(storage).load()).toEqual({ slug: "club-demo", name: "Club Démo", logoUrl: null, accentColor: "#123456", timezone: "Europe/Paris" });
  });

  it("données illisibles ou slug invalide : aucun club (retour à « Choisis ton club »), jamais de plantage", async () => {
    expect(parseDefaultClub("{pas du json")).toBeNull();
    expect(parseDefaultClub(JSON.stringify({ slug: "Club Démo!" }))).toBeNull();
    expect(await createDefaultClubRepository(memoryStorage({ [DEFAULT_CLUB_KEY]: "42" })).load()).toBeNull();
  });

  it("champs absents : valeurs par défaut", () => {
    expect(parseDefaultClub(JSON.stringify({ slug: "club-demo" }))).toEqual({ slug: "club-demo", name: null, logoUrl: null, accentColor: null, timezone: "Europe/Paris" });
  });

  it("oublier le club efface la préférence", async () => {
    const storage = memoryStorage({ [DEFAULT_CLUB_KEY]: JSON.stringify({ slug: "club-demo" }) });
    await createDefaultClubRepository(storage).save(null);
    expect(storage.dump()).toEqual({});
  });
});
