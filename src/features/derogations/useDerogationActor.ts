import { useRoles } from "@/features/roles/useRoles";
import { useActiveClub } from "@/auth/SessionProvider";

/** Personne qui agit sur les dérogations : coordinateur / créateur autorisé, sinon un coach, sinon la première personne. */
export function useDerogationActor(): string | null {
  const club = useActiveClub();
  const { roles } = useRoles();
  const coach = roles.coachTeams[0]?.coachLicencieId ?? null;
  return roles.actorFor("derogations") ?? coach ?? club.people[0]?.licencieId ?? null;
}
