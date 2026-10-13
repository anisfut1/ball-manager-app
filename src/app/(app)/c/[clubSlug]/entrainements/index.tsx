import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi, type TrainingOccurrenceDto, type TrainingSeriesDto } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, Screen } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubHeader } from "@/features/home/ClubHeader";
import { useRoles } from "@/features/roles/useRoles";
import { attendanceText, countsSummary, dayOf, formatDateKey, locationLabel, seriesLabel, teamDisplayName, timeOf } from "@/features/team-life/web-labels";
import { addDaysKey, dayKey, formatLongDay, zonedToUtcIso } from "@/lib/dates";

/** Séances affichées : les 4 prochaines semaines. */
const UPCOMING_DAYS = 28;
/** Séances passées : les 2 dernières (sur 30 jours), pour relever absents et retards. */
const PAST_DAYS = 30;
const PAST_SHOWN = 2;

const capitalize = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

/**
 * Entraînements — copie de la page Entraînements du web (TeamTrainingsManager) :
 * le coach gère les équipes qu'il coache, l'admin du club toutes les équipes.
 * Créneaux de la semaine (planifier, modifier à partir d'une date, arrêter),
 * dernières séances (relever absents / retards), prochaines séances.
 */
export default function TrainingsScreen() {
  const { equipe } = useLocalSearchParams<{ equipe?: string }>();
  const club = useActiveClub();
  const { roles, loading } = useRoles();
  const all = useQuery({ queryKey: queryKeys.teams(club.clubSlug), queryFn: () => teamLifeApi.teams(club.clubSlug), staleTime: 10 * 60_000, enabled: roles.isClubAdmin });
  const teams = useMemo(
    () =>
      roles.isClubAdmin
        ? (all.data?.teams ?? [])
            .filter((t) => t.active)
            .map((t) => ({ id: t.id, name: teamDisplayName(t) }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }))
        : roles.coachTeams.map((t) => ({ id: t.id, name: t.name })),
    [roles.isClubAdmin, roles.coachTeams, all.data],
  );
  const [picked, setPicked] = useState<string | null>(equipe ?? null);
  const teamId = picked && teams.some((t) => t.id === picked) ? picked : (teams[0]?.id ?? "");
  const team = teams.find((t) => t.id === teamId);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Retour", headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />
      <ClubHeader title="Entraînements" />
      <AppText variant="callout" tone="muted">
        Les créneaux de ton équipe et les réponses des joueurs.
      </AppText>
      <Button label="Planning" variant="ghost" icon={<Ionicons name="calendar-outline" size={18} color={colors.foreground} />} onPress={() => router.push("/planning")} style={styles.start} />
      {loading || (roles.isClubAdmin && all.isPending) ? <CardSkeletons count={3} /> : null}
      {all.error ? <ErrorState title="Entraînements indisponibles" message={humanMessage(all.error)} onRetry={() => void all.refetch()} /> : null}
      {!loading && !(roles.isClubAdmin && all.isPending) && teams.length === 0 ? (
        <EmptyState icon="lock-closed-outline" title="Réservé aux coachs" message="Seuls les coachs (pour leurs équipes) et les administrateurs du club planifient les entraînements. Un administrateur peut te désigner coach depuis la liste des joueurs." />
      ) : null}
      {teams.length > 1 ? <TeamChips teams={teams} value={teamId} onChange={setPicked} /> : null}
      {team ? <TeamTrainings key={team.id} teamId={team.id} teamName={team.name} as={roles.coachFor(team.id)} /> : null}
    </Screen>
  );
}

function TeamChips({ teams, value, onChange }: { teams: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  const accent = useClubAccent();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {teams.map((t) => {
        const on = t.id === value;
        return (
          <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(t.id)} style={[styles.chip, on && { backgroundColor: accent.accent, borderColor: accent.accent }]}>
            <AppText variant="meta" color={on ? accent.ink : colors.foreground} style={styles.chipText}>
              {t.name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function TeamTrainings({ teamId, teamName, as }: { teamId: string; teamName: string; as: string | null }) {
  const club = useActiveClub();
  const tz = club.timezone;
  const queryClient = useQueryClient();
  const today = dayKey(new Date(), tz);
  const series = useQuery({ queryKey: queryKeys.trainingSeries(club.clubSlug, teamId), queryFn: () => teamLifeApi.series(club.clubSlug, as!, teamId), enabled: !!as });
  // Bornes figées au montage : une clé de requête stable (pas de « maintenant » qui change à chaque rendu).
  const [range] = useState(() => {
    const now = new Date();
    return { now: now.toISOString(), to: zonedToUtcIso(addDaysKey(today, UPCOMING_DAYS), "00:00", tz), pastFrom: new Date(now.getTime() - PAST_DAYS * 86_400_000).toISOString() };
  });
  const upcoming = useQuery({ queryKey: [...queryKeys.teamTrainings(club.clubSlug, teamId), "upcoming", range.now], queryFn: () => teamLifeApi.teamTrainings(club.clubSlug, as!, teamId, range.now, range.to), enabled: !!as });
  const past = useQuery({ queryKey: [...queryKeys.teamTrainings(club.clubSlug, teamId), "past", range.now], queryFn: () => teamLifeApi.teamTrainings(club.clubSlug, as!, teamId, range.pastFrom, range.now), enabled: !!as });
  const pastShown = useMemo(() => (past.data?.trainings ?? []).filter((x) => x.status === "scheduled").sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, PAST_SHOWN), [past.data]);
  const days = useMemo(() => {
    const groups = new Map<string, TrainingOccurrenceDto[]>();
    for (const t of [...(upcoming.data?.trainings ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const key = dayKey(t.startsAt, tz);
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    return [...groups.entries()].map(([key, items]) => ({ key, label: capitalize(formatLongDay(items[0]!.startsAt, tz)), items }));
  }, [upcoming.data, tz]);

  const stop = useMutation({
    mutationFn: (s: TrainingSeriesDto) => teamLifeApi.stopSeries(club.clubSlug, as!, s.id, today),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainingSeries(club.clubSlug, teamId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamTrainings(club.clubSlug, teamId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
    },
  });
  const confirmStop = (s: TrainingSeriesDto) =>
    Alert.alert("Arrêter ce créneau ?", `${seriesLabel(s)} : plus de séance à partir d'aujourd'hui. Les séances où quelqu'un a déjà répondu restent visibles, marquées « annulées ».`, [
      { text: "Annuler", style: "cancel" },
      { text: "Arrêter le créneau", style: "destructive", onPress: () => stop.mutate(s) },
    ]);
  const openTraining = (id: string) => router.push(`/c/${club.clubSlug}/entrainements/${id}`);
  const plan = () => router.push(`/c/${club.clubSlug}/equipes/${teamId}/creneaux`);

  if (!as) return <ErrorState title="Accès réservé" message="Seuls les coachs de l'équipe planifient les entraînements." />;
  const error = series.error ?? upcoming.error ?? past.error;
  if (error) return <ErrorState title="Entraînements indisponibles" message={humanMessage(error)} onRetry={() => void Promise.all([series.refetch(), upcoming.refetch(), past.refetch()])} />;
  if (series.isPending || upcoming.isPending || past.isPending) return <CardSkeletons count={4} />;

  return (
    <View style={styles.sections}>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.flex}>
            <AppText variant="headline">Créneaux de la semaine</AppText>
            <AppText variant="meta" tone="muted">{`Les entraînements habituels de ${teamName}.`}</AppText>
          </View>
          {series.data?.series.length ? <Button label="Ajouter" variant="secondary" onPress={plan} /> : null}
        </View>
        {!series.data?.series.length ? (
          <Card style={styles.gap}>
            <AppText variant="bodyStrong">Aucun entraînement planifié</AppText>
            <AppText variant="meta" tone="muted">
              Indique les créneaux de la semaine une fois : les séances de toute la saison sont créées, et les joueurs peuvent répondre.
            </AppText>
            <Button label="Planifier les entraînements" onPress={plan} />
          </Card>
        ) : (
          series.data.series.map((s) => (
            <Card key={s.id} padded={false} style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons name="barbell-outline" size={18} color={colors.info} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{seriesLabel(s)}</AppText>
                <AppText variant="meta" tone="muted" numberOfLines={1}>
                  {`${locationLabel(s.location) ? `${locationLabel(s.location)} · ` : ""}jusqu'au ${formatDateKey(s.endsOn)}`}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Modifier ${seriesLabel(s)}`} onPress={() => router.push(`/c/${club.clubSlug}/entrainements/creneau/${s.id}?equipe=${teamId}`)} style={styles.iconButton}>
                <Ionicons name="pencil-outline" size={18} color={colors.foreground} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Arrêter ${seriesLabel(s)}`} disabled={stop.isPending} onPress={() => confirmStop(s)} style={styles.iconButton}>
                <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
              </Pressable>
            </Card>
          ))
        )}
        {stop.error ? <Banner tone="danger" message={humanMessage(stop.error)} /> : null}
      </View>

      {pastShown.length ? (
        <View style={styles.section}>
          <AppText variant="headline">Dernières séances</AppText>
          <AppText variant="meta" tone="muted">
            Touchez une séance pour noter les retards et les absents.
          </AppText>
          {pastShown.map((t) => (
            <Pressable key={t.id} accessibilityRole="button" onPress={() => openTraining(t.id)} style={({ pressed }) => [pressed && styles.pressed]}>
              <Card padded={false} style={styles.row}>
                <View style={styles.pastDay}>
                  <AppText variant="bodyStrong">{capitalize(dayOf(t.startsAt, tz))}</AppText>
                  <AppText variant="meta" tone="muted">
                    {timeOf(t.startsAt, tz)}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" style={styles.flex}>
                  {attendanceText(t.attendance)}
                </AppText>
                {t.attendance?.recorded ? null : <Badge tone="warning" label="À relever" />}
                <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="headline">Prochaines séances</AppText>
        <AppText variant="meta" tone="muted">
          Réponses reçues des joueurs. Touchez une séance pour voir qui vient, l&apos;annuler ou la modifier.
        </AppText>
        {days.length === 0 ? (
          <AppText variant="meta" tone="muted">
            Aucune séance dans les 4 prochaines semaines.
          </AppText>
        ) : (
          days.map((g) => (
            <View key={g.key} style={styles.gap}>
              <AppText variant="bodyStrong" style={styles.dayTitle}>
                {g.label}
              </AppText>
              {g.items.map((t) => {
                const cancelled = t.status === "cancelled";
                return (
                  <Pressable key={t.id} accessibilityRole="button" onPress={() => openTraining(t.id)} style={({ pressed }) => [pressed && styles.pressed]}>
                    <Card padded={false} style={[styles.row, cancelled && styles.cancelled]}>
                      <View style={styles.time}>
                        <AppText variant="numeric" style={[styles.bold, cancelled && styles.strike]}>
                          {timeOf(t.startsAt, tz)}
                        </AppText>
                        <AppText variant="meta" tone="muted">
                          {timeOf(t.endsAt, tz)}
                        </AppText>
                      </View>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong">{t.counts ? countsSummary(t.counts) : "Entraînement"}</AppText>
                        {locationLabel(t.location) ? (
                          <AppText variant="meta" tone="muted" numberOfLines={1}>
                            {locationLabel(t.location)}
                          </AppText>
                        ) : null}
                      </View>
                      {cancelled ? <Badge tone="danger" label="Annulée" /> : t.isModified ? <Badge tone="warning" label="Modifiée" /> : null}
                      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: "center", backgroundColor: colors.surfaceRaised },
  chipText: { fontWeight: "600" },
  sections: { gap: spacing.xl },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  gap: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.infoSoft },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  pastDay: { width: 104 },
  pressed: { opacity: 0.8 },
  dayTitle: { paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  time: { width: 48, alignItems: "center" },
  bold: { fontWeight: "600" },
  strike: { textDecorationLine: "line-through" },
  cancelled: { opacity: 0.7 },
});
