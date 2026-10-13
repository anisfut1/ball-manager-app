import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi, type TrainingAttendanceValue, type TrainingDetailDto } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Banner, Button, Card, CardSkeletons, ChoiceGroup, EmptyState, ListRow, Screen, SectionHeader, Sheet, TextField, type BadgeTone, type Choice } from "@/components/ui";
import { spacing } from "@/design";
import { ActionItem } from "@/features/home/ActionCards";
import { actionKey } from "@/features/home/action-center-model";
import { useActionCenter, useAnswer } from "@/features/home/useActionCenter";
import { useCoachTraining } from "@/features/training/useCoachTraining";
import { dayKey, formatLongDay, formatTime } from "@/lib/dates";

const RESPONSE: Record<string, { label: string; tone: BadgeTone }> = { PRESENT: { label: "Présent·e", tone: "success" }, ABSENT: { label: "Absent·e", tone: "danger" }, UNCERTAIN: { label: "Incertain·e", tone: "warning" } };
const ATTENDANCE: Choice<TrainingAttendanceValue>[] = [
  { value: "PRESENT", label: "Présent", tone: "positive" },
  { value: "LATE", label: "Retard", tone: "neutral" },
  { value: "ABSENT", label: "Absent", tone: "negative" },
];

/** Séance : réponse de la famille (en un geste) ; coach → réponses nominatives, présences, modifier / annuler. */
export default function TrainingScreen() {
  const { trainingId = "" } = useLocalSearchParams<{ trainingId: string }>();
  const coach = useCoachTraining(trainingId);
  const { query: center } = useActionCenter();
  const { answer, pending, error } = useAnswer();
  const mine = (center.data?.actions ?? []).filter((a) => a.type === "TRAINING_RESPONSE" && a.training.id === trainingId);
  const upcoming = center.data?.upcoming.find((e) => e.kind === "TRAINING" && e.id === trainingId);

  return (
    <Screen
      refreshing={coach.isRefetching}
      onRefresh={() => {
        void coach.refetch();
        void center.refetch();
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: "Entraînement", headerBackTitle: "Retour" }} />
      {error ? <Banner tone="danger" message={error} /> : null}
      {mine.map((a) => (
        <ActionItem key={actionKey(a)} action={a} answer={answer} disabled={pending} />
      ))}
      {coach.isPending && center.isPending ? <CardSkeletons count={2} /> : null}
      {coach.data ? <CoachTraining data={coach.data.data} as={coach.data.as} /> : null}
      {!coach.data && !mine.length && !coach.isPending && !center.isPending ? (
        upcoming ? (
          <Card>
            <AppText variant="headline">{upcoming.title}</AppText>
            <AppText variant="callout" tone="muted">
              {upcoming.location ?? ""}
            </AppText>
          </Card>
        ) : (
          <EmptyState icon="calendar-outline" title="Séance introuvable" message="Elle a peut-être été déplacée ou supprimée. Consulte le planning." />
        )
      ) : null}
      {coach.error ? <Banner tone="warning" message={humanMessage(coach.error)} /> : null}
    </Screen>
  );
}

function CoachTraining({ data, as }: { data: TrainingDetailDto; as: string }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const t = data.training;
  const tz = club.timezone;
  // Séance commencée : le serveur ouvre le relevé (`attendance` non nul) — jamais l'horloge du téléphone.
  const started = t.attendance !== null;
  const [edit, setEdit] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ date: dayKey(t.startsAt, tz), startTime: formatTime(t.startsAt, tz), endTime: formatTime(t.endsAt, tz), location: t.location.label ?? "" });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.training(club.clubSlug, t.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.teamTrainings(club.clubSlug, t.team.id) });
  };
  const attendance = useMutation({ mutationFn: (v: { licencieId: string; status: TrainingAttendanceValue }) => teamLifeApi.markAttendance(club.clubSlug, as, t.id, v.licencieId, v.status), onSuccess: refresh });
  const update = useMutation({
    mutationFn: () => teamLifeApi.updateTraining(club.clubSlug, as, t.id, {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        // Lieu inchangé : on garde le gymnase du club (jamais converti en texte libre).
        ...(t.location.clubVenueId && form.location === (t.location.label ?? "") ? { clubVenueId: t.location.clubVenueId, locationLabel: null } : { clubVenueId: null, locationLabel: form.location.trim() || null }),
      }),
    onSuccess: () => (refresh(), setEdit(false)),
  });
  const cancel = useMutation({ mutationFn: () => teamLifeApi.cancelTraining(club.clubSlug, as, t.id, reason.trim() || null), onSuccess: () => (refresh(), setCancelOpen(false)) });
  const restore = useMutation({ mutationFn: () => teamLifeApi.restoreTraining(club.clubSlug, as, t.id), onSuccess: refresh });
  const error = attendance.error ?? update.error ?? cancel.error ?? restore.error;
  const c = t.counts;

  return (
    <View style={styles.box}>
      <Card>
        <AppText variant="eyebrow" tone="subtle">
          {t.team.name}
        </AppText>
        <AppText variant="title">{`${formatLongDay(t.startsAt, tz)} · ${formatTime(t.startsAt, tz)}–${formatTime(t.endsAt, tz)}`}</AppText>
        {t.location.label ? <AppText variant="callout" tone="muted">{t.location.label}</AppText> : null}
        {t.status === "cancelled" ? <Badge tone="danger" label={t.cancelReason ? `Annulé · ${t.cancelReason}` : "Annulé"} /> : null}
        {t.isModified ? <Badge tone="info" label="Séance modifiée" /> : null}
        {c ? <AppText variant="callout">{`${c.present} présent·e·s · ${c.absent} absent·e·s · ${c.uncertain} incertain·e·s · ${c.noResponse} sans réponse`}</AppText> : null}
      </Card>
      {error ? <Banner tone="danger" message={humanMessage(error)} /> : null}
      {t.canManage ? (
        <View style={styles.row}>
          {t.status === "cancelled" ? (
            <Button label="Rétablir la séance" variant="secondary" loading={restore.isPending} onPress={() => restore.mutate()} style={styles.flex} />
          ) : (
            <>
              <Button label="Modifier" variant="secondary" onPress={() => setEdit(true)} style={styles.flex} />
              <Button label="Annuler" variant="danger" onPress={() => setCancelOpen(true)} style={styles.flex} />
            </>
          )}
        </View>
      ) : null}

      <SectionHeader title={started ? "Présences (relevé du coach)" : "Réponses"} />
      <Card padded={false} style={styles.list}>
        {data.roster.map((r) => (
          <View key={r.licencie.id} style={styles.entry}>
            <ListRow title={`${r.licencie.firstName} ${r.licencie.lastName}`} leading={<Avatar firstName={r.licencie.firstName} lastName={r.licencie.lastName} photoUrl={r.licencie.photoUrl} />} trailing={<Badge tone={r.response ? (RESPONSE[r.response]?.tone ?? "neutral") : "neutral"} label={r.response ? (RESPONSE[r.response]?.label ?? r.response) : "Sans réponse"} />} />
            {started && t.canManage && t.status !== "cancelled" ? (
              <ChoiceGroup accessibilityLabel={`Présence réelle de ${r.licencie.firstName}`} choices={ATTENDANCE} value={r.attendance ?? null} disabled={attendance.isPending} onChange={(status) => attendance.mutate({ licencieId: r.licencie.id, status })} />
            ) : null}
          </View>
        ))}
      </Card>

      <Sheet visible={edit} title="Modifier cette séance" onClose={() => setEdit(false)}>
        <AppText variant="callout" tone="muted">
          Seule cette séance change ; le créneau habituel reste le même. Les familles sont prévenues.
        </AppText>
        <TextField label="Date (AAAA-MM-JJ)" value={form.date} onChangeText={(date) => setForm({ ...form, date })} keyboardType="numbers-and-punctuation" />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Début" value={form.startTime} onChangeText={(startTime) => setForm({ ...form, startTime })} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
          <View style={styles.flex}>
            <TextField label="Fin" value={form.endTime} onChangeText={(endTime) => setForm({ ...form, endTime })} keyboardType="numbers-and-punctuation" maxLength={5} />
          </View>
        </View>
        <TextField label="Lieu" value={form.location} onChangeText={(location) => setForm({ ...form, location })} />
        {update.error ? <Banner tone="danger" message={humanMessage(update.error)} /> : null}
        <Button label="Enregistrer" loading={update.isPending} onPress={() => update.mutate()} fullWidth />
      </Sheet>
      <Sheet visible={cancelOpen} title="Annuler la séance" onClose={() => setCancelOpen(false)}>
        <AppText variant="callout" tone="muted">
          La séance reste visible, marquée « Annulée ». Les familles sont prévenues.
        </AppText>
        <TextField label="Raison (facultatif)" value={reason} onChangeText={setReason} maxLength={200} />
        {cancel.error ? <Banner tone="danger" message={humanMessage(cancel.error)} /> : null}
        <Button label="Annuler la séance" variant="danger" loading={cancel.isPending} onPress={() => cancel.mutate()} fullWidth />
      </Sheet>
      <Button label="Voir l'équipe" variant="ghost" onPress={() => router.push(`/c/${club.clubSlug}/equipes/${t.team.id}`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  list: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  entry: { gap: spacing.xs, paddingBottom: spacing.sm },
});
