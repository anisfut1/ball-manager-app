import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { teamLifeApi, type PlanningEvent } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Card, CardSkeletons, EmptyState, ErrorState, SegmentedControl } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { formatDateKey, mondayOf, timeOf } from "@/features/team-life/web-labels";
import { addDaysKey, dayKey, zonedToUtcIso } from "@/lib/dates";
import { groupByDay, type PlanningFilter } from "./planning-model";

const short = (key: string) => formatDateKey(key).replace(/ \d{4}$/, "");

/**
 * Planning semaine par semaine — copie du PlanningView du web : semaine
 * précédente / suivante, Tout / Matchs / Entraînements, groupé par jour du
 * club. `teamId` : page Équipe (seulement cette équipe).
 */
export function WeekPlanning({ teamId }: { teamId?: string }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const tz = club.timezone;
  const people = club.people.map((p) => p.licencieId);
  const thisWeek = mondayOf(dayKey(new Date(), tz));
  const [week, setWeek] = useState(thisWeek);
  const [kind, setKind] = useState<PlanningFilter>("ALL");
  const from = zonedToUtcIso(week, "00:00", tz);
  const to = zonedToUtcIso(addDaysKey(week, 7), "00:00", tz);
  const query = useQuery({ queryKey: ["planning", club.clubSlug, "week", week, ...people], queryFn: () => teamLifeApi.planning(club.clubSlug, people, from, to), enabled: people.length > 0 });
  const sections = useMemo(() => groupByDay((query.data?.events ?? []).filter((e) => !teamId || e.team?.id === teamId), tz, kind), [query.data, teamId, tz, kind]);
  const title = week === thisWeek ? "Cette semaine" : week === addDaysKey(thisWeek, 7) ? "Semaine prochaine" : `Semaine du ${short(week)}`;

  return (
    <View style={styles.box}>
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Semaine précédente" onPress={() => setWeek(addDaysKey(week, -7))} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <View style={styles.navText}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="meta" tone="muted">
            {`${short(week)} – ${short(addDaysKey(week, 6))}`}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Semaine suivante" onPress={() => setWeek(addDaysKey(week, 7))} style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
          <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
        </Pressable>
      </View>
      <SegmentedControl
        value={kind}
        onChange={setKind}
        options={[
          { value: "ALL", label: "Tout" },
          { value: "MATCH", label: "Matchs" },
          { value: "TRAINING", label: "Entraînements" },
        ]}
      />
      {query.isPending ? <CardSkeletons count={3} /> : null}
      {query.error ? <ErrorState title="Planning indisponible" message={humanMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data && sections.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Rien de prévu cette semaine"
          message={kind === "TRAINING" ? "Aucun entraînement planifié sur cette semaine." : kind === "MATCH" ? "Aucun match cette semaine." : "Ni match ni entraînement sur cette semaine."}
        />
      ) : null}
      {sections.map((s) => (
        <View key={s.key} style={styles.day}>
          <AppText variant="bodyStrong" style={styles.dayTitle}>
            {s.title}
          </AppText>
          {s.data.map((e) => (
            <EventCard key={`${e.kind}:${e.id}`} event={e} tz={tz} accentSoft={accent.soft} accentText={accent.text} onPress={() => router.push(e.kind === "MATCH" ? `/c/${club.clubSlug}/matchs/${e.id}` : `/c/${club.clubSlug}/entrainements/${e.id}`)} />
          ))}
        </View>
      ))}
    </View>
  );
}

function EventCard({ event, tz, accentSoft, accentText, onPress }: { event: PlanningEvent; tz: string; accentSoft: string; accentText: string; onPress: () => void }) {
  const cancelled = event.status === "cancelled";
  const isMatch = event.kind === "MATCH";
  const title = isMatch ? `Match contre ${event.title}` : event.title;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${timeOf(event.startsAt, tz)}`} onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      <Card padded={false} style={[styles.card, cancelled && styles.cancelled]}>
        <View style={styles.time}>
          <AppText variant="numeric" numberOfLines={1} style={[styles.timeText, cancelled && styles.strike]}>
            {timeOf(event.startsAt, tz)}
          </AppText>
          {event.endsAt ? (
            <AppText variant="meta" tone="muted">
              {timeOf(event.endsAt, tz)}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.icon, { backgroundColor: isMatch ? accentSoft : colors.infoSoft }]}>
          <Ionicons name={isMatch ? "trophy-outline" : "barbell-outline"} size={18} color={isMatch ? accentText : colors.info} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" style={cancelled && styles.strike}>
            {title}
          </AppText>
          <AppText variant="meta" tone="muted">
            {[event.team?.name, isMatch && event.isHome !== null ? (event.isHome ? "Domicile" : "Extérieur") : null, event.location].filter(Boolean).join(" · ")}
          </AppText>
        </View>
        {cancelled ? <Badge tone="danger" label="Annulé" /> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  nav: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navText: { flex: 1, alignItems: "center" },
  arrow: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  pressed: { opacity: 0.75 },
  day: { gap: spacing.sm, marginTop: spacing.sm },
  dayTitle: { paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  card: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.md },
  cancelled: { opacity: 0.7 },
  time: { minWidth: 60, alignItems: "center" },
  timeText: { fontWeight: "600" },
  strike: { textDecorationLine: "line-through" },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, gap: 2 },
});
