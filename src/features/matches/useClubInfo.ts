import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";

/** Nom, logo et couleur du club actif (logo absent de la session : lu une fois, mis en cache). */
export function useClubInfo() {
  const club = useActiveClub();
  const info = useQuery({ queryKey: queryKeys.club(club.clubSlug), queryFn: () => authApi.club(club.clubSlug), staleTime: 60 * 60_000 });
  return { slug: club.clubSlug, name: info.data?.name ?? club.clubName, logoUrl: info.data?.logoUrl ?? null, accentColor: info.data?.accentColor ?? club.accentColor, timezone: club.timezone };
}
