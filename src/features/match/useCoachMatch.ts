import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { teamLifeApi, type MatchTeamLifeDto } from "@/api/endpoints/teamLife";
import { useActiveClub } from "@/auth/SessionProvider";
import { useRoles } from "@/features/roles/useRoles";

/**
 * Vue coach d'un match : essaie chaque personne de l'appareil qui coache
 * (ou administre) — c'est le SERVEUR qui décide (403 si ce n'est pas son
 * équipe). `null` = pas de vue coach pour ce match.
 */
export function useCoachMatch(matchId: string) {
  const club = useActiveClub();
  const { roles } = useRoles();
  const candidates = [...new Set([...roles.coachTeams.map((t) => t.coachLicencieId), ...(roles.isClubAdmin ? [roles.coachFor("*") ?? ""] : [])].filter(Boolean))];
  return useQuery({
    queryKey: [...queryKeys.matchTeamLife(club.clubSlug, matchId), ...candidates],
    enabled: candidates.length > 0,
    queryFn: async (): Promise<{ as: string; data: MatchTeamLifeDto } | null> => {
      for (const as of candidates) {
        try {
          return { as, data: await teamLifeApi.matchTeamLife(club.clubSlug, as, matchId) };
        } catch (error) {
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) continue;
          throw error;
        }
      }
      return null;
    },
  });
}
