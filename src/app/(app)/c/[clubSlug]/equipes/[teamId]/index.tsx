import { Stack, useLocalSearchParams } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { Screen } from "@/components/ui";
import { TeamPage, teamTabOf } from "@/features/team/TeamPage";

/** Page Équipe (même écran que le web : Vue d'ensemble / Planning / Effectif). */
export default function TeamScreen() {
  const { teamId = "", tab } = useLocalSearchParams<{ teamId: string; tab?: string }>();
  const club = useActiveClub();
  const queryClient = useQueryClient();
  return (
    <Screen
      refreshing={false}
      onRefresh={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.teamOverview(club.clubSlug, teamId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Équipes" }} />
      <TeamPage teamId={teamId} initialTab={teamTabOf(tab)} />
    </Screen>
  );
}
