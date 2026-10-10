import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, CardSkeletons, ErrorState, ListRow, Screen, SectionHeader, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { useRoles } from "@/features/roles/useRoles";
import { nextSlot, slotProblems, toCreateBody, WEEKDAYS, type SlotInput } from "@/features/training/series-model";
import { dayKey } from "@/lib/dates";

/**
 * Créneaux récurrents en moins d'une minute : « Mardi 19h–20h30, Maurice
 * Clavel » [+ Ajouter] « Jeudi … » [Enregistrer]. Séances générées jusqu'à
 * la fin de la saison.
 */
export default function SeriesScreen() {
  const { teamId = "" } = useLocalSearchParams<{ teamId: string }>();
  const club = useActiveClub();
  const accent = useClubAccent();
  const { roles } = useRoles();
  const as = roles.coachFor(teamId);
  const queryClient = useQueryClient();
  const series = useQuery({ queryKey: queryKeys.trainingSeries(club.clubSlug, teamId), queryFn: () => teamLifeApi.series(club.clubSlug, as!, teamId), enabled: !!as });
  const [slots, setSlots] = useState<SlotInput[]>([nextSlot(undefined)]);
  const problems = slots.map(slotProblems).filter(Boolean);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.trainingSeries(club.clubSlug, teamId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
  };
  const create = useMutation({ mutationFn: () => teamLifeApi.createSeries(club.clubSlug, as!, teamId, toCreateBody(slots, dayKey(new Date(), club.timezone))), onSuccess: () => (refresh(), router.back()) });
  const stop = useMutation({ mutationFn: (seriesId: string) => teamLifeApi.stopSeries(club.clubSlug, as!, seriesId), onSuccess: refresh });
  const update = (i: number, patch: Partial<SlotInput>) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  if (!as) return <ErrorState title="Accès réservé" message="Seuls les coachs de l'équipe planifient les entraînements." />;
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Entraînements", headerBackTitle: "Équipe" }} />
      {series.isPending ? <CardSkeletons count={1} /> : null}
      {series.data?.series.length ? (
        <>
          <SectionHeader title="Créneaux en cours" />
          <Card padded={false} style={styles.list}>
            {series.data.series.map((s) => (
              <ListRow key={s.id} title={`${WEEKDAYS.find((d) => d.value === s.weekday)?.label ?? ""} ${s.startTime}–${s.endTime}`} subtitle={[s.location.label, `${s.upcomingCount} séances à venir`].filter(Boolean).join(" · ")} trailing={<Button label="Arrêter" variant="ghost" loading={stop.isPending} onPress={() => stop.mutate(s.id)} />} />
            ))}
          </Card>
        </>
      ) : null}
      <SectionHeader title="Nouveaux créneaux" />
      {slots.map((slot, i) => (
        <Card key={i}>
          <View style={styles.days} accessibilityRole="radiogroup" accessibilityLabel="Jour">
            {WEEKDAYS.map((d) => (
              <Pressable key={d.value} accessibilityRole="radio" accessibilityState={{ selected: slot.weekday === d.value }} accessibilityLabel={d.label} onPress={() => update(i, { weekday: d.value })} style={[styles.day, slot.weekday === d.value && { backgroundColor: accent.accent, borderColor: accent.accent }]}>
                <AppText variant="meta" color={slot.weekday === d.value ? accent.ink : colors.foreground} style={styles.dayText}>
                  {d.label.slice(0, 3)}
                </AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="Début" value={slot.startTime} onChangeText={(startTime) => update(i, { startTime })} keyboardType="numbers-and-punctuation" maxLength={5} />
            </View>
            <View style={styles.flex}>
              <TextField label="Fin" value={slot.endTime} onChangeText={(endTime) => update(i, { endTime })} keyboardType="numbers-and-punctuation" maxLength={5} />
            </View>
          </View>
          <TextField label="Lieu" value={slot.location} onChangeText={(location) => update(i, { location })} placeholder="Gymnase Maurice Clavel" />
          {slotProblems(slot) ? <AppText variant="meta" tone="danger">{slotProblems(slot)}</AppText> : null}
          {slots.length > 1 ? <Button label="Retirer ce créneau" variant="ghost" onPress={() => setSlots(slots.filter((_, j) => j !== i))} /> : null}
        </Card>
      ))}
      <Button label="+ Ajouter un créneau" variant="secondary" onPress={() => setSlots([...slots, nextSlot(slots[slots.length - 1])])} disabled={slots.length >= 7} />
      {create.error ? <Banner tone="danger" message={humanMessage(create.error)} /> : null}
      {stop.error ? <Banner tone="danger" message={humanMessage(stop.error)} /> : null}
      <Button label="Enregistrer" size="lg" loading={create.isPending} disabled={problems.length > 0} onPress={() => create.mutate()} fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg },
  days: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  day: { minWidth: 44, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  dayText: { fontWeight: "600" },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
});
