import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { teamLifeApi, type TrainingDetailDto } from "@/api/endpoints/teamLife";
import { useActiveClub } from "@/auth/SessionProvider";
import { useRoles } from "@/features/roles/useRoles";

/** Détail nominatif d'une séance : coachs / admins seulement — le serveur décide (403 sinon). */
export function useCoachTraining(occurrenceId: string) {
  const club = useActiveClub();
  const { roles } = useRoles();
  const candidates = [...new Set([...roles.coachTeams.map((t) => t.coachLicencieId), ...(roles.isClubAdmin ? [roles.coachFor("*") ?? ""] : [])].filter(Boolean))];
  return useQuery({
    queryKey: [...queryKeys.training(club.clubSlug, occurrenceId), ...candidates],
    enabled: candidates.length > 0,
    queryFn: async (): Promise<{ as: string; data: TrainingDetailDto } | null> => {
      for (const as of candidates) {
        try {
          return { as, data: await teamLifeApi.training(club.clubSlug, as, occurrenceId) };
        } catch (error) {
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) continue;
          throw error;
        }
      }
      return null;
    },
  });
}
