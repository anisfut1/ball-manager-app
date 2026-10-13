import { Stack } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Screen } from "@/components/ui";
import { colors } from "@/design";
import { ClubHeader } from "@/features/home/ClubHeader";
import { WeekPlanning } from "@/features/planning/WeekPlanning";

/** Planning — copie du PublicPlanningApp du web : matchs et entraînements de tes équipes, semaine par semaine. */
export default function PlanningScreen() {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  return (
    <Screen refreshing={false} onRefresh={() => void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) })}>
      <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Plus", headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />
      <ClubHeader title="Planning" />
      <AppText variant="callout" tone="muted">
        Matchs et entraînements de tes équipes, semaine par semaine.
      </AppText>
      <WeekPlanning />
    </Screen>
  );
}
