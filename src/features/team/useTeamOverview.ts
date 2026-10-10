import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { teamLifeApi, type TeamOverviewDto } from "@/api/endpoints/teamLife";
import { useActiveClub } from "@/auth/SessionProvider";
import { useRoles } from "@/features/roles/useRoles";

/** Page Équipe : joueurs de l'équipe et ceux qui la gèrent (le serveur décide). Coach essayé en premier. */
export function useTeamOverview(teamId: string) {
  const club = useActiveClub();
  const { roles } = useRoles();
  const candidates = [...new Set([roles.coachFor(teamId), ...roles.memberTeams.filter((t) => t.id === teamId).map((t) => t.licencieId)].filter((x): x is string => !!x))];
  return useQuery({
    queryKey: [...queryKeys.teamOverview(club.clubSlug, teamId), ...candidates],
    enabled: candidates.length > 0,
    queryFn: async (): Promise<{ as: string; data: TeamOverviewDto } | null> => {
      for (const as of candidates) {
        try {
          return { as, data: await teamLifeApi.teamOverview(club.clubSlug, as, teamId) };
        } catch (error) {
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) continue;
          throw error;
        }
      }
      return null;
    },
  });
}
