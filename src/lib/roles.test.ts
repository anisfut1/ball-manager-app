import type { ActionCenterDto, PublicMeDto } from "@/api/endpoints/teamLife";
import { mergeRoles } from "./roles";

const person = (licencieId: string, team: string | null, coach: string[] = []): ActionCenterDto["people"][number] => ({
  tokenIndex: 0,
  licencieId,
  firstName: licencieId,
  lastName: "Exemple",
  team: team ? { id: team, name: team.toUpperCase() } : null,
  coachTeams: coach.map((id) => ({ id, name: id.toUpperCase() })),
});
const me = (overrides: Partial<PublicMeDto> = {}): PublicMeDto => ({
  licencie: { id: "x", firstName: "x", lastName: "x" } as PublicMeDto["licencie"],
  isClubAdmin: false,
  derogationRequests: { canCreate: false, canManage: false },
  tables: { canManage: false },
  ...overrides,
});

describe("rôles fusionnés (jamais de « choisis ton mode »)", () => {
  it("parent de deux enfants + coach d'une autre équipe : tout à la fois", () => {
    const roles = mergeRoles([person("lina", "u15f"), person("mathis", "u11m"), person("coach-papa", null, ["u13m"])], {});
    expect(roles.memberTeams.map((t) => t.id)).toEqual(["u15f", "u11m"]);
    expect(roles.isCoach).toBe(true);
    expect(roles.coachFor("u13m")).toBe("coach-papa");
    expect(roles.coachFor("u15f")).toBeNull();
  });
  it("droits tables / dérogations portés par la bonne personne", () => {
    const roles = mergeRoles([person("a", "t1"), person("b", "t2")], { a: me(), b: me({ tables: { canManage: true }, derogationRequests: { canCreate: true, canManage: false } }) });
    expect(roles.canManageTables).toBe(true);
    expect(roles.actorFor("tables")).toBe("b");
    expect(roles.actorFor("derogations-create")).toBe("b");
    expect(roles.canManageDerogations).toBe(false);
  });
  it("admin du club : peut agir en coach sur toute équipe", () => {
    const roles = mergeRoles([person("admin", null)], { admin: me({ isClubAdmin: true }) });
    expect(roles.coachFor("n-importe")).toBe("admin");
  });
  it("dérogations officielles FBI : coordinateur OU admin du club (comme le web)", () => {
    const coordo = mergeRoles([person("c", "t1")], { c: me({ derogationRequests: { canCreate: false, canManage: true } }) });
    expect(coordo.canManageOfficialDerogations).toBe(true);
    expect(coordo.actorFor("official")).toBe("c");
    const admin = mergeRoles([person("a", null)], { a: me({ isClubAdmin: true }) });
    expect(admin.canManageOfficialDerogations).toBe(true);
    expect(admin.actorFor("official")).toBe("a");
    const coach = mergeRoles([person("k", null, ["u13m"])], { k: me({ derogationRequests: { canCreate: true, canManage: false } }) });
    expect(coach.canManageOfficialDerogations).toBe(false);
    expect(coach.actorFor("official")).toBeNull();
  });
});
