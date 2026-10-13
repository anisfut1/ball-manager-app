import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { Screen } from "@/components/ui";
import { colors } from "@/design";
import { ClubHeader } from "@/features/home/ClubHeader";
import { MatchesList } from "@/features/matches/MatchesList";

/** Derniers résultats du club (comme la page Résultats du web). */
export default function ResultsScreen() {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  return (
    <Screen edges={[]} onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.matches(club.clubSlug, "past") })}>
      <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Plus", headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />
      <ClubHeader title="Résultats" />
      <MatchesList period="past" />
    </Screen>
  );
}
