import { useQueries, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { teamLifeApi, type PublicMeDto } from "@/api/endpoints/teamLife";
import { useActiveClub } from "@/auth/SessionProvider";
import { mergeRoles } from "@/lib/roles";

/** Rôles fusionnés de toutes les personnes de l'appareil pour le club actif. */
export function useRoles() {
  const club = useActiveClub();
  const people = club.people.map((p) => p.licencieId);
  const center = useQuery({ queryKey: queryKeys.actionCenter(club.clubSlug, people), queryFn: () => teamLifeApi.actionCenter(club.clubSlug, people), enabled: people.length > 0 });
  const mes = useQueries({ queries: people.map((id) => ({ queryKey: ["me", club.clubSlug, id] as const, queryFn: () => teamLifeApi.me(club.clubSlug, id), staleTime: 5 * 60_000 })) });
  const byId: Record<string, PublicMeDto | undefined> = {};
  people.forEach((id, i) => (byId[id] = mes[i]?.data));
  return { roles: mergeRoles(center.data?.people ?? [], byId), loading: center.isPending };
}
