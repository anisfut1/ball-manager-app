import { nextSlot, seasonEnd, slotProblems, toCreateBody } from "./series-model";

describe("créneaux d'entraînement", () => {
  it("fin de saison : 30 juin suivant", () => {
    expect(seasonEnd("2026-10-15")).toBe("2027-06-30");
    expect(seasonEnd("2027-03-01")).toBe("2027-06-30");
  });
  it("« + Ajouter » copie le créneau précédent, deux jours plus tard (mardi → jeudi)", () => {
    const tuesday = { weekday: 2, startTime: "19:00", endTime: "20:30", location: "Maurice Clavel" };
    expect(nextSlot(tuesday)).toEqual({ weekday: 4, startTime: "19:00", endTime: "20:30", location: "Maurice Clavel" });
    expect(nextSlot(undefined).weekday).toBe(2);
  });
  it("validation des heures", () => {
    expect(slotProblems({ weekday: 2, startTime: "20:30", endTime: "19:00", location: "" })).toMatch(/après/);
    expect(slotProblems({ weekday: 2, startTime: "19h", endTime: "20:30", location: "" })).toMatch(/HH:MM/);
    expect(slotProblems({ weekday: 2, startTime: "19:00", endTime: "20:30", location: "" })).toBeNull();
  });
  it("corps API : convention 0 = dimanche, lieu vide → null", () => {
    expect(toCreateBody([{ weekday: 0, startTime: "10:00", endTime: "11:30", location: " " }], "2026-10-15")).toEqual({ slots: [{ weekday: 0, startTime: "10:00", endTime: "11:30", locationLabel: null }], startsOn: "2026-10-15", endsOn: "2027-06-30" });
  });
});
