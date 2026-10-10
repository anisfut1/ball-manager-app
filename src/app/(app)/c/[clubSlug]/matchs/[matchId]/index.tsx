import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Card, CardSkeletons, ErrorState, Screen, SectionHeader } from "@/components/ui";
import { colors, spacing } from "@/design";
import { ActionItem } from "@/features/home/ActionCards";
import { actionKey } from "@/features/home/action-center-model";
import { useActionCenter, useAnswer } from "@/features/home/useActionCenter";
import { CoachMatchPanel } from "@/features/match/CoachMatchPanel";
import { useCoachMatch } from "@/features/match/useCoachMatch";
import { matchTitle } from "@/features/team-life/labels";
import { formatLongDay, formatTime } from "@/lib/dates";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  played: { label: "Joué", tone: "neutral" },
  postponed: { label: "Reporté", tone: "warning" },
  cancelled: { label: "Annulé", tone: "danger" },
  forfeit: { label: "Forfait", tone: "danger" },
};

/** Match : infos (FFBB), ce qui concerne MA famille (dispo / convocation / maillots), et la vue coach si autorisée. */
export default function MatchScreen() {
  const { matchId = "", section } = useLocalSearchParams<{ matchId: string; section?: string }>();
  const club = useActiveClub();
  const details = useQuery({ queryKey: queryKeys.match(club.clubSlug, matchId), queryFn: () => teamLifeApi.matchDetails(club.clubSlug, matchId) });
  const coach = useCoachMatch(matchId);
  const { query: center } = useActionCenter();
  const { answer, pending, error } = useAnswer();
  const mine = (center.data?.actions ?? []).filter((a) => a.type !== "COACH_MATCH" && a.type !== "COACH_TRAINING_SUMMARY" && "match" in a && a.match.id === matchId);
  const m = details.data;
  const coachFirst = section === "coach" || section === "maillots";

  const family = mine.length ? (
    <View style={styles.block}>
      <SectionHeader title="Pour ce match" />
      {error ? <Banner tone="danger" message={error} /> : null}
      {mine.map((a) => (
        <ActionItem key={actionKey(a)} action={a} answer={answer} disabled={pending} />
      ))}
    </View>
  ) : null;
  const coachPanel = coach.data ? <CoachMatchPanel data={coach.data.data} as={coach.data.as} openLaundry={section === "maillots"} /> : null;

  return (
    <Screen
      refreshing={details.isRefetching}
      onRefresh={() => {
        void details.refetch();
        void coach.refetch();
        void center.refetch();
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: "Match", headerBackTitle: "Retour" }} />
      {details.isPending ? <CardSkeletons count={2} /> : null}
      {details.error ? <ErrorState message={humanMessage(details.error)} onRetry={() => void details.refetch()} /> : null}
      {m ? (
        <Card>
          <AppText variant="eyebrow" tone="subtle">
            {[m.competitionName, m.journee ? `J${m.journee}` : null].filter(Boolean).join(" · ") || "Match"}
          </AppText>
          <AppText variant="title">{matchTitle(m.teamName ?? "", m.opponentName, m.isHome)}</AppText>
          <View style={styles.row}>
            {m.isHome !== null ? <Badge label={m.isHome ? "Domicile" : "Extérieur"} /> : null}
            {STATUS[m.status] ? <Badge tone={STATUS[m.status]!.tone} label={STATUS[m.status]!.label} /> : null}
          </View>
          {m.matchDatetime ? (
            <View style={styles.line}>
              <Ionicons name="calendar-outline" size={18} color={colors.muted} />
              <AppText variant="body">{`${formatLongDay(m.matchDatetime, club.timezone)} · ${formatTime(m.matchDatetime, club.timezone)}`}</AppText>
            </View>
          ) : null}
          {m.venueLabel ? (
            <View style={styles.line}>
              <Ionicons name="location-outline" size={18} color={colors.muted} />
              <AppText variant="body" style={styles.flex}>
                {m.venueLabel}
              </AppText>
            </View>
          ) : null}
          {m.scoreHome !== null && m.scoreAway !== null ? <AppText variant="numeric">{`${m.scoreHome} – ${m.scoreAway}`}</AppText> : null}
        </Card>
      ) : null}
      {coachFirst ? coachPanel : family}
      {coachFirst ? family : coachPanel}
      {coach.error ? <Banner tone="warning" message={humanMessage(coach.error)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
