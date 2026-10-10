import { contrastRatio, deriveClubAccent, FALLBACK_ACCENT } from "./accent";

describe("deriveClubAccent", () => {
  it("couleur absente ou invalide : repli Ball Manager", () => {
    expect(deriveClubAccent(null).accent).toBe(FALLBACK_ACCENT);
    expect(deriveClubAccent("rouge").accent).toBe(FALLBACK_ACCENT);
  });

  it("club jaune : identité gardée, texte assombri jusqu'à 4.5:1, encre graphite", () => {
    const yellow = deriveClubAccent("#FFD400");
    expect(yellow.accent).toBe("#FFD400");
    expect(yellow.ink).toBe("#17171A");
    expect(contrastRatio(yellow.text, "#ECEAE4")).toBeGreaterThanOrEqual(4.5);
  });

  it("club bleu foncé : encre blanche, texte inchangé", () => {
    const navy = deriveClubAccent("#0B2A6F");
    expect(navy.ink).toBe("#FFFFFF");
    expect(navy.text).toBe("#0B2A6F");
  });
});
