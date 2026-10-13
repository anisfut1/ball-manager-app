import type { PublicHomeDto } from "@/api/endpoints/clubSpace";
import type { ActionCenterDto } from "@/api/endpoints/teamLife";
import { buildAgenda } from "./agenda";

const match = (id: string, at: string | null) => ({ match: { id, matchDatetime: at } as PublicHomeDto["upcoming"][number]["match"], relations: ["PLAYER" as const] });
const event = (kind: "MATCH" | "TRAINING", id: string, at: string, teamId: string) =>
  ({ kind, id, team: { id: teamId, name: "SF" }, startsAt: at, endsAt: null, title: "x", isHome: null, location: null, status: "scheduled", forFirstNames: ["Lina"] }) as ActionCenterDto["upcoming"][number];

describe("Mon agenda (même règle que le web)", () => {
  it("fusionne matchs et entraînements, sans doublon, par date, sans date à la fin", () => {
    const home = { upcoming: [match("m1", "2026-10-18T18:00:00Z"), match("m2", null)] };
    const center = {
      people: [{ tokenIndex: 0, licencieId: "l1", firstName: "Lina", lastName: "X", team: { id: "t1", name: "SF" }, coachTeams: [{ id: "t2", name: "U13" }] }],
      upcoming: [event("MATCH", "m1", "2026-10-18T18:00:00Z", "t1"), event("TRAINING", "e1", "2026-10-16T19:00:00Z", "t2")],
    };
    const items = buildAgenda(home, center);
    expect(items.map((i) => i.key)).toEqual(["TRAINING-e1", "m-m1", "m-m2"]);
    const training = items[0];
    expect(training.kind === "EVENT" && training.relations).toEqual(["COACH"]);
  });
});
