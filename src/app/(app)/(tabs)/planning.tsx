import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { teamLifeApi, type PlanningEvent } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Button, Card, CardSkeletons, EmptyState, ErrorState, Screen, SegmentedControl } from "@/components/ui";
import { colors, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubHeader } from "@/features/home/ClubHeader";
import { groupByDay, type PlanningFilter } from "@/features/planning/planning-model";
import { addDaysKey, dayKey, formatTime } from "@/lib/dates";

const WEEKS = 4;

/** Planning : matchs FFBB + entraînements, par jour, en liste (pas un calendrier desktop compressé). */
export default function PlanningScreen() {
  const club = useActiveClub();
  const accent = useClubAccent();
  const people = club.people.map((p) => p.licencieId);
  const [filter, setFilter] = useState<PlanningFilter>("ALL");
  const today = dayKey(new Date(), club.timezone);

  const query = useInfiniteQuery({
    queryKey: ["planning", club.clubSlug, ...people],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      const from = addDaysKey(today, pageParam * 7 * WEEKS - (pageParam === 0 ? 1 : 0));
      const to = addDaysKey(today, (pageParam + 1) * 7 * WEEKS - 1);
      return teamLifeApi.planning(club.clubSlug, people, from, to);
    },
    getNextPageParam: (_last, pages) => (pages.length < 6 ? pages.length : undefined),
  });
  const events = useMemo(() => {
    const seen = new Map<string, PlanningEvent>();
    for (const page of query.data?.pages ?? []) for (const e of page.events) seen.set(`${e.kind}:${e.id}`, e);
    return [...seen.values()];
  }, [query.data]);
  const sections = useMemo(() => groupByDay(events, club.timezone, filter), [events, club.timezone, filter]);

  return (
    <Screen scroll={false}>
      <SectionList
        sections={sections}
        keyExtractor={(e) => `${e.kind}:${e.id}`}
        contentContainerStyle={styles.content}
        stickySectionHeadersEnabled={false}
        refreshing={query.isRefetching}
        onRefresh={() => void query.refetch()}
        ListHeaderComponent={
          <View style={styles.header}>
            <ClubHeader title="Planning" />
            <SegmentedControl
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: "Tout" },
                { value: "MATCH", label: "Matchs" },
                { value: "TRAINING", label: "Entraînements" },
              ]}
            />
            {query.isPending ? <CardSkeletons count={3} /> : null}
            {query.error && !query.data ? <ErrorState message={humanMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
          </View>
        }
        ListEmptyComponent={query.data ? <EmptyState icon="calendar-outline" title="Rien de prévu" message="Aucun match ni entraînement sur ces semaines." /> : null}
        renderSectionHeader={({ section }) => (
          <AppText variant="eyebrow" tone={section.key === today ? "default" : "subtle"} color={section.key === today ? accent.text : undefined} style={styles.day}>
            {section.key === today ? `Aujourd'hui · ${section.title}` : section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}, ${formatTime(item.startsAt, club.timezone)}`} onPress={() => router.push(item.kind === "MATCH" ? `/c/${club.clubSlug}/matchs/${item.id}` : `/c/${club.clubSlug}/entrainements/${item.id}`)} style={({ pressed }) => [pressed && styles.pressed]}>
          <Card style={styles.item}>
            <View style={styles.row}>
              <Ionicons name={item.kind === "MATCH" ? "basketball-outline" : "fitness-outline"} size={20} color={item.kind === "MATCH" ? accent.text : colors.muted} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={2}>
                  {item.title}
                </AppText>
                <AppText variant="meta" tone="muted">
                  {[`${formatTime(item.startsAt, club.timezone)}${item.endsAt ? `–${formatTime(item.endsAt, club.timezone)}` : ""}`, item.location].filter(Boolean).join(" · ")}
                </AppText>
              </View>
              {item.status === "cancelled" ? <Badge tone="danger" label="Annulé" /> : item.status === "postponed" ? <Badge tone="warning" label="Reporté" /> : item.kind === "MATCH" && item.isHome !== null ? <Badge label={item.isHome ? "Domicile" : "Extérieur"} /> : null}
            </View>
          </Card>
          </Pressable>
        )}
        ListFooterComponent={query.hasNextPage ? <Button label="Voir les semaines suivantes" variant="ghost" loading={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingBottom: spacing.xxxl * 2, gap: spacing.sm },
  header: { gap: spacing.lg, paddingBottom: spacing.sm },
  day: { paddingTop: spacing.lg, paddingBottom: spacing.xs },
  item: { padding: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  pressed: { opacity: 0.75 },
});
