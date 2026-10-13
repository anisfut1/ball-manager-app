import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Screen } from "@/components/ui";
import { ClubHeader } from "@/features/home/ClubHeader";
import { MatchesView } from "@/features/matches/MatchesView";

/** Onglet « Matchs » : la page Matchs du web (filtres, journées, salles). */
export default function MatchesTab() {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  return (
    <Screen onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.season(club.clubSlug) })}>
      <ClubHeader title="Matchs de la saison" />
      <AppText variant="callout" tone="muted">
        Horaires, salles et résultats, mis à jour automatiquement.
      </AppText>
      <MatchesView />
    </Screen>
  );
}
