import { searchableNameQuery } from "./name-query";

describe("recherche de nom (prénom + nom)", () => {
  it("attend le prénom ET le nom", () => {
    expect(searchableNameQuery("")).toBeNull();
    expect(searchableNameQuery("Anis")).toBeNull();
    expect(searchableNameQuery("Anis A")).toBeNull();
    expect(searchableNameQuery("  Anis   Ab ")).toBe("Anis Ab");
  });

  it("refuse les requêtes trop longues", () => {
    expect(searchableNameQuery("a b c d e f g")).toBeNull();
    expect(searchableNameQuery(`Léa ${"x".repeat(80)}`)).toBeNull();
  });
});
