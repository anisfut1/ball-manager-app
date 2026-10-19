import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, CardSkeletons, EmptyState, ErrorState, Screen, SectionHeader } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubHeader } from "@/features/home/ClubHeader";
import { MatchCard } from "@/features/matches/MatchCard";
import { matchOutcome } from "@/features/matches/match-model";
import { useClubInfo } from "@/features/matches/useClubInfo";
import { StandingsTable } from "@/features/results/StandingsTable";
import { buildResultGroups, clubStandingRow, ordinal, recordLabel, type ResultGroup } from "@/features/results/result-groups";
import { currentSeasonStart } from "@/lib/season";

/** Onglet « Résultats » (public), comme la page Résultats du web : scores de la saison et classements FFBB, équipe par équipe. */
export default function ResultsScreen() {
  const club = useClubInfo();
  const [selected, setSelected] = useState<string | null>(null);
  const data = useQuery({
    queryKey: queryKeys.results(club.slug),
    queryFn: async () => {
      const now = new Date();
      const [matches, standings] = await Promise.all([clubSpaceApi.allMatches(club.slug, { from: currentSeasonStart(now).toISOString(), to: now.toISOString() }), clubSpaceApi.standings(club.slug).catch(() => [])]);
      return { matches, standings };
    },
  });
  const groups = useMemo(() => (data.data ? buildResultGroups(data.data.matches, data.data.standings, club.name) : []), [data.data, club.name]);
  const group = selected ? (groups.find((g) => g.key === selected) ?? null) : null;

  return (
    <Screen refreshing={data.isRefetching} onRefresh={() => void data.refetch()}>
      <ClubHeader title="Résultats" />
      <AppText variant="callout" tone="muted">
        Scores de la saison et classements FFBB, équipe par équipe.
      </AppText>
      {data.isPending ? <CardSkeletons count={3} /> : null}
      {data.error ? <ErrorState message={humanMessage(data.error)} onRetry={() => void data.refetch()} /> : null}
      {data.data && groups.length === 0 ? <EmptyState icon="trophy-outline" title="Aucun résultat pour l'instant" message="Les scores et classements apparaissent ici dès qu'ils sont publiés par la FFBB." /> : null}
      {groups.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
          <Chip label="Toutes" active={!group} onPress={() => setSelected(null)} />
          {groups.map((g) => (
            <Chip key={g.key} label={g.label} active={group?.key === g.key} onPress={() => setSelected(g.key)} />
          ))}
        </ScrollView>
      ) : null}
      {group ? <GroupDetail group={group} club={club} /> : groups.map((g) => <GroupCard key={g.key} group={g} onPress={() => setSelected(g.key)} />)}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const accent = useClubAccent();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active ? { backgroundColor: accent.soft, borderColor: accent.accent } : null]}>
      <AppText variant="callout" color={active ? accent.text : colors.muted} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );
}

function GroupCard({ group, onPress }: { group: ResultGroup; onPress: () => void }) {
  const accent = useClubAccent();
  const pool = group.standings[0] ?? null;
  const ours = pool ? clubStandingRow(pool) : null;
  const last = group.results[0] ?? null;
  const outcome = last ? matchOutcome(last) : null;
  const ourScore = last ? (last.isHome === false ? last.scoreAway : last.scoreHome) : null;
  const theirScore = last ? (last.isHome === false ? last.scoreHome : last.scoreAway) : null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHead}>
        <View style={styles.flex}>
          <AppText variant="headline">{group.label}</AppText>
          {group.competitionName ? (
            <AppText variant="meta" tone="muted" numberOfLines={1}>
              {group.competitionName}
            </AppText>
          ) : null}
        </View>
        {ours?.position != null ? (
          <View style={[styles.rank, { backgroundColor: accent.soft }]}>
            <AppText variant="meta" color={accent.text} style={styles.bold}>
              {ordinal(ours.position)}
              {pool ? ` / ${pool.rows.length}` : ""}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="meta" tone="muted">
        {group.results.length ? recordLabel(group.record) : "Pas encore de résultat"}
        {ours?.points != null ? ` · ${ours.points} pts` : ""}
      </AppText>
      {last ? (
        <View style={styles.last}>
          <View style={[styles.outcome, outcome === "win" ? styles.win : outcome === "loss" ? styles.loss : styles.draw]}>
            <AppText variant="meta" style={styles.bold} color={outcome === "win" ? colors.success : outcome === "loss" ? colors.danger : colors.muted}>
              {outcome === "win" ? "V" : outcome === "loss" ? "D" : "N"}
            </AppText>
          </View>
          <AppText variant="callout" numberOfLines={1} style={styles.flex}>
            {last.isHome === false ? "à" : "vs"} {last.opponentName ?? "?"}
          </AppText>
          <AppText variant="bodyStrong">
            {ourScore} – {theirScore}
          </AppText>
        </View>
      ) : null}
      <View style={styles.more}>
        <AppText variant="meta" color={accent.text} style={styles.bold}>
          Classement et résultats
        </AppText>
        <Ionicons name="arrow-forward" size={14} color={accent.text} />
      </View>
    </Pressable>
  );
}

function GroupDetail({ group, club }: { group: ResultGroup; club: ReturnType<typeof useClubInfo> }) {
  return (
    <>
      {group.standings.length === 0 ? <EmptyState title="Classement pas encore disponible" message="Il apparaîtra ici à la prochaine synchronisation FFBB." /> : group.standings.map((pool) => <StandingsTable key={pool.poolId} pool={pool} clubLogoUrl={club.logoUrl} />)}
      <SectionHeader title={group.results.length ? `Derniers résultats · ${recordLabel(group.record)}` : "Derniers résultats"} />
      {group.results.length === 0 ? <EmptyState icon="trophy-outline" title="Pas encore de résultat" message="Les scores apparaissent dès qu'ils sont publiés par la FFBB." /> : null}
      {group.results.map((m) => (
        <MatchCard key={m.id} match={m} club={club} onPress={() => router.push(`/c/${club.slug}/matchs/${m.id}`)} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  chipBar: { marginHorizontal: -spacing.gutter },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  chip: { height: 40, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  chipText: { fontWeight: "600" },
  card: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  pressed: { opacity: 0.85 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  flex: { flex: 1 },
  rank: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: radius.pill },
  bold: { fontWeight: "700" },
  last: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  outcome: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  win: { backgroundColor: colors.successSoft },
  loss: { backgroundColor: colors.dangerSoft },
  draw: { backgroundColor: colors.surfaceMuted },
  more: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
