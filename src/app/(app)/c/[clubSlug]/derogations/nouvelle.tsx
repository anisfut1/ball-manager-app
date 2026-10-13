import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { derogationsApi, type DerogationContextDto } from "@/api/endpoints/derogations";
import { ApiError, humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { AWAY_NOTICE, formatDayLongCapitalized, formatShortDateTime, NO_COORDINATOR_MESSAGE, PENDING_WARNING } from "@/features/derogations/labels";
import { MatchHeadline } from "@/features/derogations/parts";
import { DateChooser, SlotChooser, type SlotSelection } from "@/features/derogations/SlotPicker";
import { useDerogationActor } from "@/features/derogations/useDerogationActor";

const STEPS = ["Match", "Date", "Créneau", "Résumé"] as const;
type Step = 0 | 1 | 2 | 3;

/** Demander une dérogation — copie de l'assistant du web : Match → Date → Créneau → Résumé → Envoyer. */
export default function NewDerogationScreen() {
  const { match } = useLocalSearchParams<{ match?: string }>();
  const club = useActiveClub();
  const { as, loading } = useDerogationActor();
  const context = useQuery({ queryKey: queryKeys.derogationContext(club.clubSlug), queryFn: () => derogationsApi.context(club.clubSlug, as!), enabled: !!as });
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: "Demander une dérogation", headerBackTitle: "Dérogations" }} />
      {loading || context.isPending ? (
        <View style={styles.pad}>
          <CardSkeletons count={3} />
        </View>
      ) : !as ? (
        <View style={styles.pad}>
          <ErrorState title="Accès réservé" message="Les dérogations sont réservées aux coachs, au coordinateur et aux administrateurs du club." />
        </View>
      ) : context.error ? (
        <View style={styles.pad}>
          <ErrorState message={humanMessage(context.error)} onRetry={() => void context.refetch()} />
        </View>
      ) : context.data ? (
        <Wizard as={as} context={context.data} initialMatchId={match ?? null} />
      ) : null}
    </>
  );
}

function Wizard({ as, context, initialMatchId }: { as: string; context: DerogationContextDto; initialMatchId: string | null }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const queryClient = useQueryClient();
  const scroll = useRef<ScrollView>(null);
  const initial = context.eligibleMatches.find((m) => m.id === initialMatchId && !m.activeRequestId) ?? null;
  const [step, setStep] = useState<Step>(initial ? 1 : 0);
  const [matchId, setMatchId] = useState<string | null>(initial?.id ?? null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotSelection | null>(null);
  const [comment, setComment] = useState("");
  const [requesterName, setRequesterName] = useState(context.requesterDisplayName);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const match = useMemo(() => context.eligibleMatches.find((m) => m.id === matchId) ?? null, [context.eligibleMatches, matchId]);
  const tz = context.timezone;
  const askName = context.requesterNameSource === "EMAIL";
  const base = `/c/${club.clubSlug}/derogations`;

  const go = (next: Step) => {
    setError(null);
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  async function send() {
    if (!match || !slot) return;
    setSending(true);
    setError(null);
    try {
      const created = await derogationsApi.create(club.clubSlug, as, { matchId: match.id, requestedStartAt: slot.startAt, requestedVenueId: slot.venueId, comment: comment.trim() || null, requesterDisplayName: askName ? requesterName.trim() || null : null });
      void queryClient.invalidateQueries({ queryKey: queryKeys.derogations(club.clubSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.derogationContext(club.clubSlug) });
      router.replace(`${base}/${created.id}?sent=1`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DEROGATION_SLOT_CONFLICT") {
        // Créneau pris entre-temps : retour au planning, rafraîchi.
        setSlot(null);
        setStep(2);
        void queryClient.invalidateQueries({ queryKey: ["derogation-availability", club.clubSlug, match.id] });
      }
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer la demande pour le moment. Réessaie dans quelques minutes.");
      setSending(false);
    }
  }

  if (!context.canCreate) {
    return (
      <View style={styles.pad}>
        <EmptyState icon="calendar-outline" title="Aucune équipe à ta charge" message="Seul un coach peut demander une dérogation pour les matchs de ses équipes. Demande à l'administrateur du club de t'attribuer le rôle Coach." />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText variant="callout" tone="muted">
          Choisis le match, la nouvelle date et un créneau libre : le coordinateur du club reçoit ta demande.
        </AppText>
        <View>
          <AppText variant="meta" tone="muted">
            {"Étape "}
            {step + 1} sur {STEPS.length} · <AppText variant="meta" style={styles.bold}>{STEPS[step]}</AppText>
          </AppText>
          <View style={styles.stepper}>
            {STEPS.map((label, i) => (
              <Pressable key={label} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${label}`} disabled={i >= step} onPress={() => go(i as Step)} style={styles.flex}>
                <View style={[styles.bar, { backgroundColor: i === step ? accent.accent : i < step ? accent.soft : colors.border }]} />
              </Pressable>
            ))}
          </View>
        </View>
        {!context.coordinatorsConfigured ? <Banner tone="warning" message={`${NO_COORDINATOR_MESSAGE} Tu pourras préparer ta demande, mais pas l'envoyer tant qu'un coordinateur n'est pas désigné par l'administrateur.`} /> : null}
        {error ? <Banner tone="danger" message={error} /> : null}

        {step === 0 ? (
          <View style={styles.gap}>
            <AppText variant="title">Quel match veux-tu déplacer ?</AppText>
            {context.eligibleMatches.length === 0 ? <EmptyState icon="calendar-outline" title="Aucun match à venir" message="Aucun match à venir n'est programmé pour tes équipes." /> : null}
            {context.eligibleMatches.map((m) =>
              m.activeRequestId ? (
                <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push(`${base}/${m.activeRequestId}`)} style={[styles.matchRow, styles.dashed]}>
                  <View style={styles.flex}>
                    <MatchHeadline match={m} timezone={tz} />
                  </View>
                  <AppText variant="meta" color={accent.text} style={styles.bold}>
                    Demande en cours ›
                  </AppText>
                </Pressable>
              ) : (
                <Pressable
                  key={m.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: m.id === matchId }}
                  onPress={() => {
                    if (m.id !== matchId) {
                      setSlot(null);
                      setDate(null);
                    }
                    setMatchId(m.id);
                    go(1);
                  }}
                  style={[styles.matchRow, m.id === matchId && { borderColor: accent.accent }]}
                >
                  <View style={styles.flex}>
                    <MatchHeadline match={m} timezone={tz} />
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
                </Pressable>
              ),
            )}
          </View>
        ) : null}

        {step >= 1 && match ? (
          <Card>
            <MatchHeadline match={match} timezone={tz} />
          </Card>
        ) : null}

        {step === 1 && match ? (
          <View style={styles.gap}>
            <AppText variant="title">Quelle date ?</AppText>
            <DateChooser
              timezone={tz}
              value={date}
              onChange={(d) => {
                if (d !== date) setSlot(null);
                setDate(d);
              }}
            />
          </View>
        ) : null}

        {step === 2 && match && date ? (
          <View style={styles.gap}>
            <AppText variant="title">{`${formatDayLongCapitalized(`${date}T12:00:00Z`, "UTC")} — quel créneau ?`}</AppText>
            <SlotChooser as={as} matchId={match.id} date={date} timezone={tz} venues={context.venues} value={slot} onChange={setSlot} />
          </View>
        ) : null}

        {step === 3 && match && slot ? (
          <View style={styles.gap}>
            <AppText variant="title">Résumé de la demande</AppText>
            <Card style={styles.gap}>
              <Summary label="Date actuelle" value={formatShortDateTime(match.matchDatetime, tz)} />
              <Summary label="Nouveau créneau demandé" value={`${formatDayLongCapitalized(slot.startAt, tz)} · ${slot.localStart} → ${slot.localEnd}`} strong />
              <Summary label="Gymnase" value={slot.venueName ?? "À l'extérieur — à confirmer avec le club adverse"} />
              <Summary label="Demande formulée par" value={askName ? requesterName.trim() || "—" : context.requesterDisplayName} />
              {match.isHome === false ? <Banner tone="info" message={AWAY_NOTICE} /> : null}
              {slot.warnings.length > 0 ? <Banner tone="warning" message={PENDING_WARNING} /> : null}
            </Card>
            {askName ? <TextField label="Ton prénom" hint="Affiché au coordinateur : « Demande formulée par … »." value={requesterName} onChangeText={setRequesterName} maxLength={80} autoComplete="given-name" /> : null}
            <TextField label="Message au coordinateur (facultatif)" hint="Ex. : la salle est libre ce jour-là, l'adversaire est d'accord…" value={comment} onChangeText={setComment} multiline maxLength={3000} />
            <Banner tone="info" message="La demande part au coordinateur du club, qui s'occupe des démarches officielles. Le calendrier officiel n'est pas modifié automatiquement." />
          </View>
        ) : null}
      </ScrollView>

      {step > 0 ? (
        <View style={styles.footer}>
          <Button label="Retour" variant="ghost" icon={<Ionicons name="arrow-back" size={18} color={colors.foreground} />} onPress={() => go((step - 1) as Step)} />
          {step === 1 ? <Button label="Voir les créneaux" disabled={!date} onPress={() => go(2)} /> : null}
          {step === 2 ? <Button label={slot ? `Continuer avec ${slot.localStart}` : "Choisis un créneau"} disabled={!slot} onPress={() => go(3)} /> : null}
          {step === 3 ? <Button label="Envoyer la demande" loading={sending} disabled={!context.coordinatorsConfigured || (askName && !requesterName.trim())} onPress={() => void send()} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summary}>
      <AppText variant="eyebrow" tone="subtle">
        {label}
      </AppText>
      <AppText variant={strong ? "bodyStrong" : "body"}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pad: { padding: spacing.gutter },
  content: { padding: spacing.gutter, gap: spacing.lg, paddingBottom: spacing.xxxl * 2 },
  gap: { gap: spacing.md },
  flex: { flex: 1 },
  bold: { fontWeight: "600" },
  stepper: { flexDirection: "row", gap: 6, marginTop: spacing.sm },
  bar: { height: 4, borderRadius: 2 },
  matchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  dashed: { borderStyle: "dashed", backgroundColor: colors.surface },
  summary: { gap: 2 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, paddingBottom: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
});
