import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi, type TrainingSeriesDto } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, CardSkeletons, ErrorState, Screen, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { useRoles } from "@/features/roles/useRoles";
import { seriesLabel, WEEKDAY_NAMES, WEEKDAY_ORDER } from "@/features/team-life/web-labels";
import { dayKey } from "@/lib/dates";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Modifier un créneau à partir d'une date — copie du SeriesEditSheet du web. */
export default function SeriesEditScreen() {
  const { seriesId = "", equipe = "" } = useLocalSearchParams<{ seriesId: string; equipe?: string }>();
  const club = useActiveClub();
  const { roles } = useRoles();
  const as = roles.coachFor(equipe);
  const series = useQuery({ queryKey: queryKeys.trainingSeries(club.clubSlug, equipe), queryFn: () => teamLifeApi.series(club.clubSlug, as!, equipe), enabled: !!as && !!equipe });
  const current = series.data?.series.find((s) => s.id === seriesId);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Modifier le créneau", headerBackTitle: "Retour" }} />
      {!as ? <ErrorState title="Accès réservé" message="Seuls les coachs de l'équipe modifient les entraînements." /> : null}
      {series.isPending && as ? <CardSkeletons count={2} /> : null}
      {series.error ? <ErrorState message={humanMessage(series.error)} onRetry={() => void series.refetch()} /> : null}
      {series.data && !current ? <ErrorState title="Créneau introuvable" message="Il a peut-être été arrêté entre-temps." /> : null}
      {current && as ? <EditForm key={current.id} series={current} teamId={equipe} as={as} /> : null}
    </Screen>
  );
}

function EditForm({ series, teamId, as }: { series: TrainingSeriesDto; teamId: string; as: string }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const queryClient = useQueryClient();
  const today = dayKey(new Date(), club.timezone);
  const originalLocation = series.location.label ?? "";
  const [fromDate, setFromDate] = useState(today > series.startsOn ? today : series.startsOn);
  const [weekday, setWeekday] = useState(series.weekday);
  const [startTime, setStartTime] = useState(series.startTime);
  const [endTime, setEndTime] = useState(series.endTime);
  const [endsOn, setEndsOn] = useState(series.endsOn);
  const [location, setLocation] = useState(originalLocation);
  const problem = !DATE.test(fromDate) || !DATE.test(endsOn) ? "Dates au format AAAA-MM-JJ." : !TIME.test(startTime) || !TIME.test(endTime) ? "Heures au format HH:MM." : endTime <= startTime ? "L'heure de fin doit être après l'heure de début." : fromDate < today ? "La date de départ ne peut pas être passée." : endsOn < fromDate ? "La fin doit être après la date de départ." : null;

  const save = useMutation({
    mutationFn: () =>
      teamLifeApi.updateSeries(club.clubSlug, as, series.id, {
        fromDate,
        weekday,
        startTime,
        endTime,
        endsOn,
        // Lieu inchangé : on garde le gymnase du club ; sinon lieu libre.
        ...(series.location.clubVenueId && location === originalLocation ? { clubVenueId: series.location.clubVenueId, locationLabel: null } : { clubVenueId: null, locationLabel: location.trim() || null }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainingSeries(club.clubSlug, teamId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.teamTrainings(club.clubSlug, teamId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
      router.back();
    },
  });

  return (
    <View style={styles.box}>
      <AppText variant="callout" tone="muted">{`${seriesLabel(series)} — les séances avant la date choisie restent inchangées.`}</AppText>
      <Card style={styles.box}>
        <TextField label="À partir du (AAAA-MM-JJ)" value={fromDate} onChangeText={setFromDate} keyboardType="numbers-and-punctuation" maxLength={10} />
        <AppText variant="meta" tone="muted">
          Première séance concernée par le changement.
        </AppText>
        <View style={styles.days} accessibilityRole="radiogroup" accessibilityLabel="Jour">
          {WEEKDAY_ORDER.map((d) => {
            const on = weekday === d;
            return (
              <Pressable key={d} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={WEEKDAY_NAMES[d]} onPress={() => setWeekday(d)} style={[styles.day, on && { backgroundColor: accent.accent, borderColor: accent.accent }]}>
                <AppText variant="meta" color={on ? accent.ink : colors.foreground} style={styles.dayText}>
                  {WEEKDAY_NAMES[d].slice(0, 3)}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Début" value={startTime} onChangeText={setStartTime} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={styles.flex}>
            <TextField label="Fin" value={endTime} onChangeText={setEndTime} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </View>
        <TextField label="Lieu" value={location} onChangeText={setLocation} placeholder="Gymnase, salle…" maxLength={120} />
        <TextField label="Jusqu'au (AAAA-MM-JJ)" value={endsOn} onChangeText={setEndsOn} keyboardType="numbers-and-punctuation" maxLength={10} />
        {problem ? (
          <AppText variant="meta" tone="danger">
            {problem}
          </AppText>
        ) : null}
      </Card>
      {save.error ? <Banner tone="danger" message={humanMessage(save.error)} /> : null}
      <Button label="Enregistrer" size="lg" loading={save.isPending} disabled={problem !== null} onPress={() => save.mutate()} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  days: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  day: { minWidth: 44, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  dayText: { fontWeight: "600" },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
});
