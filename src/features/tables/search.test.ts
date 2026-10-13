import { matchesSearch } from "./search";

describe("recherche du panneau de désignation", () => {
  const teams = [{ name: "U15 M" }];
  it("vide : tout le monde", () => expect(matchesSearch("  ", "Clarence Christophe", teams)).toBe(true));
  it("début de prénom ou de nom, sans casse", () => {
    expect(matchesSearch("clar", "Clarence Christophe", teams)).toBe(true);
    expect(matchesSearch("CHRIS", "Clarence Christophe", teams)).toBe(true);
  });
  it("sans accents", () => expect(matchesSearch("jeremy", "Jérémy Gonzales", teams)).toBe(true));
  it("par équipe", () => expect(matchesSearch("u15", "Rafael Gomes", teams)).toBe(true));
  it("plusieurs mots : tous requis", () => {
    expect(matchesSearch("rafael u15", "Rafael Gomes", teams)).toBe(true);
    expect(matchesSearch("rafael u17", "Rafael Gomes", teams)).toBe(false);
  });
  it("aucune correspondance", () => expect(matchesSearch("zzz", "Rafael Gomes", teams)).toBe(false));
});
