import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { Screen } from "@/components/ui";
import { ClubHeader } from "@/features/home/ClubHeader";
import { MatchesList } from "@/features/matches/MatchesList";

/** Onglet « Matchs » : prochains matchs du club (comme la page Matchs du web). */
export default function MatchesTab() {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  return (
    <Screen onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.matches(club.clubSlug, "upcoming") })}>
      <ClubHeader title="Matchs" />
      <MatchesList period="upcoming" />
    </Screen>
  );
}
