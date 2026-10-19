import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { AppText, Banner, CardSkeletons, ErrorState, Screen, SectionHeader } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ActionItem } from "@/features/home/ActionCards";
import { actionKey } from "@/features/home/action-center-model";
import { useActionCenter, useAnswer } from "@/features/home/useActionCenter";
import { MatchOfficialBlock, MatchRequestBlock } from "@/features/derogations/MatchBlocks";
import { CoachMatchPanel } from "@/features/match/CoachMatchPanel";
import { useCoachMatch } from "@/features/match/useCoachMatch";
import { clubSideLabel } from "@/features/matches/match-model";
import { useClubInfo } from "@/features/matches/useClubInfo";
import { MATCH_TABS, parseMatchTab, type MatchTab } from "@/features/matches/detail/labels";
import { CompositionPanel, EmarquePanel, InformationsPanel, OfficialsPanel, StatsPanel } from "@/features/matches/detail/Panels";
import { Scoreboard, type ScoreboardTeam } from "@/features/matches/detail/Scoreboard";

const TAB_ICONS: Record<MatchTab, keyof typeof Ionicons.glyphMap> = {
  informations: "information-circle-outline",
  composition: "people-outline",
  statistiques: "stats-chart-outline",
  officiels: "scale-outline",
  emarque: "document-text-outline",
};

/**
 * Fiche match, comme le web (MatchDetailView) : tableau de marque et cinq
 * onglets (Informations, Composition, Statistiques, Officiels, e-Marque).
 * Sur « Informations » : ce qui concerne MA famille (dispo / convocation /
 * maillots) et la vue coach si autorisée.
 */
export default function MatchScreen() {
  const { matchId = "", section, tab: tabParam } = useLocalSearchParams<{ matchId: string; section?: string; tab?: string }>();
  const info = useClubInfo();
  const { session } = useCurrentClubState();
  const accent = useClubAccent();
  const [tab, setTab] = useState<MatchTab>(parseMatchTab(tabParam));
  const documents = useQuery({ queryKey: queryKeys.matchDocuments(info.slug, matchId), queryFn: () => clubSpaceApi.matchDocuments(info.slug, matchId), enabled: tab === "emarque" });
  // Fiche publique : sans session, l'appel part sans identifiant (comme /public sur le web).
  const details = useQuery({ queryKey: queryKeys.match(info.slug, matchId), queryFn: () => teamLifeApi.matchDetails(info.slug, matchId) });
  const [member, setMember] = useState<{ refetch: () => void } | null>(null);
  const m = details.data;
  const ours: ScoreboardTeam | null = m ? { name: clubSideLabel(m, info.name), logoName: info.name, logoUrl: info.logoUrl, isClub: true, accentColor: info.accentColor } : null;
  const theirs: ScoreboardTeam | null = m ? { name: m.opponentName ?? "?", logoName: m.opponentName ?? "?", logoUrl: m.opponentLogoUrl, isClub: false } : null;
  const [home, away] = m && m.isHome === false ? [theirs, ours] : [ours, theirs];

  return (
    <Screen
      refreshing={details.isRefetching}
      onRefresh={() => {
        void details.refetch();
        member?.refetch();
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: "Match", headerBackTitle: "Retour" }} />
      {details.isPending ? <CardSkeletons count={2} /> : null}
      {details.error ? <ErrorState message={humanMessage(details.error)} onRetry={() => void details.refetch()} /> : null}
      {m && home && away ? (
        <>
          <Scoreboard match={m} home={home} away={away} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabs}>
            {MATCH_TABS.map((t) => {
              const active = t.value === tab;
              return (
                <Pressable key={t.value} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setTab(t.value)} style={[styles.tab, active && { backgroundColor: accent.soft, borderColor: accent.accent }]}>
                  <Ionicons name={TAB_ICONS[t.value]} size={16} color={active ? accent.text : colors.muted} />
                  <AppText variant="callout" color={active ? accent.text : colors.muted} style={styles.tabText}>
                    {t.label}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          {tab === "informations" ? <InformationsPanel match={m} home={home} away={away} /> : null}
          {tab === "composition" ? <CompositionPanel match={m} home={home} away={away} /> : null}
          {tab === "statistiques" ? <StatsPanel match={m} home={home} away={away} playerBase={`/c/${info.slug}/joueurs`} /> : null}
          {tab === "officiels" ? <OfficialsPanel match={m} /> : null}
          {tab === "emarque" ? documents.isPending ? <CardSkeletons count={1} /> : <EmarquePanel match={m} documents={documents.data ?? []} /> : null}
        </>
      ) : null}
      {tab === "informations" && session ? <MemberMatchBlocks matchId={matchId} section={section} onRefetch={setMember} /> : null}
    </Screen>
  );
}

/** Ce qui concerne la famille et le coach : seulement pour un licencié reconnu de ce club. */
function MemberMatchBlocks({ matchId, section, onRefetch }: { matchId: string; section?: string; onRefetch: (member: { refetch: () => void } | null) => void }) {
  const coach = useCoachMatch(matchId);
  const { query: center } = useActionCenter();
  const { answer, pending, error } = useAnswer();
  const mine = (center.data?.actions ?? []).filter((a) => a.type !== "COACH_MATCH" && a.type !== "COACH_TRAINING_SUMMARY" && "match" in a && a.match.id === matchId);
  const coachFirst = section === "coach" || section === "maillots";
  const refetchCoach = coach.refetch;
  const refetchCenter = center.refetch;
  useEffect(() => {
    onRefetch({
      refetch: () => {
        void refetchCoach();
        void refetchCenter();
      },
    });
    return () => onRefetch(null);
  }, [onRefetch, refetchCoach, refetchCenter]);

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
    <>
      {coachFirst ? coachPanel : family}
      {coachFirst ? family : coachPanel}
      {coach.error ? <Banner tone="warning" message={humanMessage(coach.error)} /> : null}
      <MatchRequestBlock matchId={matchId} />
      <MatchOfficialBlock matchId={matchId} />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.md },
  tabBar: { marginHorizontal: -spacing.gutter },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  tab: { flexDirection: "row", alignItems: "center", gap: spacing.xs, height: 40, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  tabText: { fontWeight: "600" },
});
