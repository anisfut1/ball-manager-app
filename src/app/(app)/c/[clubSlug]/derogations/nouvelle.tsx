import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { derogationsApi } from "@/api/endpoints/derogations";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, CardSkeletons, ErrorState, ListRow, Screen, SectionHeader, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { useDerogationActor } from "@/features/derogations/useDerogationActor";
import { dayKey, formatTime, relativeDayTime, zonedToUtcIso } from "@/lib/dates";

/** Nouvelle demande : match → nouveau créneau (date, heure, salle) → commentaire. Les conflits sont vérifiés par le serveur. */
export default function NewDerogationScreen() {
  const club = useActiveClub();
  const accent = useClubAccent();
  const as = useDerogationActor();
  const queryClient = useQueryClient();
  const context = useQuery({ queryKey: queryKeys.derogationContext(club.clubSlug), queryFn: () => derogationsApi.context(club.clubSlug, as!), enabled: !!as });
  const [matchId, setMatchId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", time: "", venueId: null as string | null, comment: "" });
  const tz = context.data?.timezone ?? club.timezone;
  const valid = !!matchId && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(form.time);
  const create = useMutation({
    mutationFn: () => derogationsApi.create(club.clubSlug, as!, { matchId: matchId!, requestedStartAt: zonedToUtcIso(form.date, form.time, tz), requestedVenueId: form.venueId, comment: form.comment.trim() || null }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.derogations(club.clubSlug) });
      router.replace(`/c/${club.clubSlug}/derogations/${created.id}`);
    },
  });
  const eligible = (context.data?.eligibleMatches ?? []).filter((m) => !m.activeRequestId);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Nouvelle demande", headerBackTitle: "Dérogations" }} />
      {context.isPending ? <CardSkeletons count={2} /> : null}
      {context.error ? <ErrorState message={humanMessage(context.error)} onRetry={() => void context.refetch()} /> : null}
      {context.data && !context.data.coordinatorsConfigured ? <Banner tone="warning" message="Aucun coordinateur n'est désigné au club : la demande ne pourra pas être traitée." /> : null}
      {context.data ? (
        <>
          <SectionHeader title="1. Match" />
          <Card padded={false} style={styles.list}>
            {eligible.length === 0 ? <AppText variant="callout" tone="muted" style={styles.empty}>Aucun match éligible (ou une demande est déjà en cours).</AppText> : null}
            {eligible.map((m) => (
              <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ selected: matchId === m.id }} onPress={() => (setMatchId(m.id), m.matchDatetime && setForm({ ...form, date: dayKey(m.matchDatetime, tz), time: formatTime(m.matchDatetime, tz) }))}>
                <ListRow title={`${m.teamName ?? ""} vs ${m.opponentName ?? ""}`} subtitle={m.matchDatetime ? relativeDayTime(m.matchDatetime, tz) : null} trailing={matchId === m.id ? <AppText color={accent.text}>✓</AppText> : undefined} />
              </Pressable>
            ))}
          </Card>
          <SectionHeader title="2. Nouveau créneau" />
          <Card>
            <TextField label="Date (AAAA-MM-JJ)" value={form.date} onChangeText={(date) => setForm({ ...form, date })} keyboardType="numbers-and-punctuation" />
            <TextField label="Heure (HH:MM)" value={form.time} onChangeText={(time) => setForm({ ...form, time })} keyboardType="numbers-and-punctuation" maxLength={5} />
            {context.data.venues.length ? (
              <View style={styles.venues}>
                {context.data.venues.map((v) => (
                  <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ selected: form.venueId === v.id }} onPress={() => setForm({ ...form, venueId: form.venueId === v.id ? null : v.id })} style={[styles.venue, form.venueId === v.id && { borderColor: accent.accent, backgroundColor: accent.soft }]}>
                    <AppText variant="callout">{v.name}</AppText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Card>
          <SectionHeader title="3. Commentaire" />
          <Card>
            <TextField label="Pour le coordinateur (facultatif)" value={form.comment} onChangeText={(comment) => setForm({ ...form, comment })} multiline maxLength={3000} />
          </Card>
          {create.error ? <Banner tone="danger" message={humanMessage(create.error)} /> : null}
          <Button label="Envoyer la demande" size="lg" loading={create.isPending} disabled={!valid} onPress={() => create.mutate()} fullWidth />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg },
  empty: { paddingVertical: spacing.lg },
  venues: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  venue: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong },
});
