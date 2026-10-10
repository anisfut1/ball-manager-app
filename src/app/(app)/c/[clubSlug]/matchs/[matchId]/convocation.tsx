import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi, type ConvocationPreviewDto, type MatchTeamLifeDto } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Banner, Button, Card, CardSkeletons, ErrorState, ListRow, Screen, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { initialDraft, meetingPresets, TIME, toDraftBody, toggle, validate, type Draft } from "@/features/convocation/builder-model";
import { useCoachMatch } from "@/features/match/useCoachMatch";
import { matchTitle } from "@/features/team-life/labels";
import { relativeDayTime } from "@/lib/dates";

type Step = "players" | "meeting" | "message" | "preview";
const STEPS: Step[] = ["players", "meeting", "message", "preview"];
const TITLES: Record<Step, string> = { players: "Joueurs", meeting: "Rendez-vous", message: "Message", preview: "Aperçu" };

/** Coach : sélection → RDV (heure + lieu) → message → aperçu → envoyer. */
export default function ConvocationBuilderScreen() {
  const { matchId = "" } = useLocalSearchParams<{ matchId: string }>();
  const coach = useCoachMatch(matchId);
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: "Convocation", headerBackTitle: "Match" }} />
      {coach.isPending ? <CardSkeletons count={2} /> : null}
      {coach.error ? <ErrorState message={humanMessage(coach.error)} onRetry={() => void coach.refetch()} /> : null}
      {coach.data === null ? <ErrorState title="Accès réservé" message="Seuls les coachs de l'équipe (ou un responsable du club) peuvent convoquer." /> : null}
      {coach.data ? <Builder data={coach.data.data} as={coach.data.as} /> : null}
    </Screen>
  );
}

function Builder({ data, as }: { data: MatchTeamLifeDto; as: string }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const queryClient = useQueryClient();
  const tz = club.timezone;
  const [draft, setDraft] = useState<Draft>(() => initialDraft(data, tz));
  const [step, setStep] = useState<Step>("players");
  const [preview, setPreview] = useState<ConvocationPreviewDto | null>(null);
  const problems = validate(draft, data);
  const m = data.match;
  const meetingOk = !!draft.meetingTime && TIME.test(draft.meetingTime) && (m.isHome !== false || draft.meetingPoint.trim().length > 0);

  const save = useMutation({ mutationFn: () => teamLifeApi.saveDraft(club.clubSlug, as, m.id, toDraftBody(draft, data, tz)) });
  const loadPreview = useMutation({
    mutationFn: async () => {
      await teamLifeApi.saveDraft(club.clubSlug, as, m.id, toDraftBody(draft, data, tz));
      return teamLifeApi.preview(club.clubSlug, as, m.id);
    },
    onSuccess: setPreview,
  });
  const send = useMutation({
    mutationFn: () => teamLifeApi.send(club.clubSlug, as, m.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.matchTeamLife(club.clubSlug, m.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
      router.back();
    },
  });

  const go = (next: Step) => {
    if (next === "preview") loadPreview.mutate();
    else save.mutate();
    setStep(next);
  };
  const index = STEPS.indexOf(step);
  const error = save.error ?? loadPreview.error ?? send.error;

  return (
    <View style={styles.box}>
      <Card>
        <AppText variant="eyebrow" tone="subtle">
          {m.startsAt ? relativeDayTime(m.startsAt, tz) : "Match"}
        </AppText>
        <AppText variant="headline">{matchTitle(m.team.name, m.opponent, m.isHome)}</AppText>
        <AppText variant="meta" tone="muted">
          {m.isHome === false ? `Match à l'extérieur${m.venueName ? ` · ${m.venueName}` : ""}` : `À domicile${m.venueName ? ` · ${m.venueName}` : ""}`}
        </AppText>
      </Card>

      <View style={styles.steps} accessibilityRole="tablist">
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.step, i <= index && { backgroundColor: accent.accent }]} accessibilityLabel={`Étape ${i + 1} : ${TITLES[s]}${s === step ? ", en cours" : ""}`} />
        ))}
      </View>
      <AppText variant="title" accessibilityRole="header">{`${index + 1}. ${TITLES[step]}`}</AppText>
      {error ? <Banner tone="danger" message={humanMessage(error)} /> : null}

      {step === "players" ? (
        <Card padded={false} style={styles.list}>
          {data.availability.roster.map((r) => {
            const selected = draft.licencieIds.includes(r.licencie.id);
            return (
              <Pressable key={r.licencie.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setDraft({ ...draft, licencieIds: toggle(draft.licencieIds, r.licencie.id) })}>
                <ListRow
                  title={`${r.licencie.firstName} ${r.licencie.lastName}`}
                  subtitle={r.response === "AVAILABLE" ? "Disponible" : r.response === "UNAVAILABLE" ? "Indisponible" : r.response === "UNCERTAIN" ? "Incertain·e" : "Sans réponse"}
                  leading={<Avatar firstName={r.licencie.firstName} lastName={r.licencie.lastName} photoUrl={r.licencie.photoUrl} />}
                  trailing={<Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={26} color={selected ? accent.accent : colors.subtle} />}
                />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {step === "meeting" ? (
        <Card>
          <AppText variant="bodyStrong">Heure du rendez-vous</AppText>
          <View style={styles.chips}>
            {meetingPresets(m.startsAt, tz).map((p) => (
              <Pressable key={p.time} accessibilityRole="button" accessibilityState={{ selected: draft.meetingTime === p.time }} onPress={() => setDraft({ ...draft, meetingTime: p.time })} style={[styles.chip, draft.meetingTime === p.time && { backgroundColor: accent.soft, borderColor: accent.accent }]}>
                <AppText variant="bodyStrong">{p.time}</AppText>
                <AppText variant="meta" tone="muted">
                  {p.label}
                </AppText>
              </Pressable>
            ))}
          </View>
          <TextField label="Ou une autre heure (HH:MM)" value={draft.meetingTime ?? ""} onChangeText={(t) => setDraft({ ...draft, meetingTime: t.trim() || null })} keyboardType="numbers-and-punctuation" placeholder="16:15" maxLength={5} />
          <TextField
            label={m.isHome === false ? "Lieu du rendez-vous (départ)" : "Lieu du rendez-vous"}
            hint={m.isHome === false ? "Ex. parking du gymnase du club. Le lieu du match est indiqué automatiquement." : undefined}
            value={draft.meetingPoint}
            onChangeText={(t) => setDraft({ ...draft, meetingPoint: t })}
            placeholder={m.isHome === false ? "Parking Maurice Clavel" : (m.venueName ?? "")}
          />
        </Card>
      ) : null}

      {step === "message" ? (
        <Card>
          <TextField label="Message aux familles (facultatif)" value={draft.coachMessage} onChangeText={(t) => setDraft({ ...draft, coachMessage: t })} multiline style={styles.multiline} maxLength={1000} placeholder="Ex. Pensez aux gourdes !" />
        </Card>
      ) : null}

      {step === "preview" ? (
        loadPreview.isPending || !preview ? (
          <CardSkeletons count={1} />
        ) : (
          <>
            <AppText variant="callout">{`${preview.recipientsCount} convoqué·e·s`}</AppText>
            {preview.unavailableSelected.length ? <Banner tone="warning" message={`A répondu « Indisponible » : ${preview.unavailableSelected.join(", ")}`} /> : null}
            {preview.blockers.map((b) => (
              <Banner key={b} tone="danger" message={b} />
            ))}
            {preview.samples.map((s) => (
              <Card key={`${s.audience}-${s.firstName}`}>
                <Badge label={s.audience === "GUARDIAN" ? `Parent de ${s.firstName}` : s.firstName} />
                <AppText variant="callout">{s.text}</AppText>
              </Card>
            ))}
          </>
        )
      ) : null}

      {step !== "preview" && problems.length && index > 0 ? <Banner tone="info" message={problems[0]!} /> : null}
      <View style={styles.nav}>
        {index > 0 ? <Button label="Précédent" variant="secondary" onPress={() => setStep(STEPS[index - 1]!)} style={styles.flex} /> : null}
        {step !== "preview" ? (
          <Button label="Suivant" onPress={() => go(STEPS[index + 1]!)} disabled={(step === "players" && draft.licencieIds.length === 0) || (step === "meeting" && !meetingOk)} style={styles.flex} />
        ) : (
          <Button label={data.convocation?.sent ? "Envoyer la mise à jour" : "Envoyer la convocation"} loading={send.isPending} disabled={!preview || preview.blockers.length > 0 || problems.length > 0} onPress={() => send.mutate()} style={styles.flex} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.md },
  steps: { flexDirection: "row", gap: spacing.xs },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.surfaceMuted },
  list: { paddingHorizontal: spacing.lg },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { minWidth: 76, minHeight: 52, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  nav: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.sm },
  flex: { flex: 1 },
});
