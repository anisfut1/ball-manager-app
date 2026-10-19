import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Screen } from "@/components/ui";
import { ClubHeader } from "@/features/home/ClubHeader";
import { MatchesView } from "@/features/matches/MatchesView";
import { useClubInfo } from "@/features/matches/useClubInfo";

/** Onglet « Matchs » (public) : la page Matchs du web (filtres, journées, salles). */
export default function MatchesTab() {
  const club = useClubInfo();
  const queryClient = useQueryClient();
  return (
    <Screen onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.season(club.slug) })}>
      <ClubHeader title="Matchs de la saison" />
      <AppText variant="callout" tone="muted">
        Horaires, salles et résultats, mis à jour automatiquement.
      </AppText>
      <MatchesView />
    </Screen>
  );
}
