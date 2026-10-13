import { useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { derogationsApi, type ClubVenue, type DerogationAction, type DerogationDetail } from "@/api/endpoints/derogations";
import { ApiError, humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Banner, Button, Card, CardSkeletons, ErrorState, Screen, Sheet, TextField } from "@/components/ui";
import { colors, MAX_FONT_SCALE, radius, spacing, typography } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ACTION_LABELS, AWAY_NOTICE, formatDayLongCapitalized, formatShortDateTime, formatTime, isActive, localDateKey } from "@/features/derogations/labels";
import { OfficialDerogationForm, type OfficialFormState } from "@/features/derogations/Official";
import { MatchHeadline, RequestStatusBadge } from "@/features/derogations/parts";
import { DateChooser, SlotChooser, type SlotSelection } from "@/features/derogations/SlotPicker";
import { useDerogationActor } from "@/features/derogations/useDerogationActor";

const TOASTS: Record<DerogationAction, string> = {
  TAKE_IN_CHARGE: "Tu t'occupes de cette demande.",
  REQUEST_CHANGE: "Le coach est invité à proposer un autre créneau.",
  COMPLETE: "Demande marquée comme traitée.",
  CANCEL: "Demande annulée.",
};

/** Conversation d'une demande (coach ↔ coordinateur) — copie du RequestThread du web. */
export default function DerogationScreen() {
  const { requestId = "", sent } = useLocalSearchParams<{ requestId: string; sent?: string }>();
  const club = useActiveClub();
  const { as, loading } = useDerogationActor();
  const detail = useQuery({ queryKey: queryKeys.derogation(club.clubSlug, requestId), queryFn: () => derogationsApi.detail(club.clubSlug, as!, requestId), enabled: !!as });
  const context = useQuery({ queryKey: queryKeys.derogationContext(club.clubSlug), queryFn: () => derogationsApi.context(club.clubSlug, as!), enabled: !!as });

  return (
    <Screen refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
      <Stack.Screen options={{ headerShown: true, title: "Dérogation", headerBackTitle: "Dérogations" }} />
      {loading || (as && (detail.isPending || context.isPending)) ? <CardSkeletons count={3} /> : null}
      {!loading && !as ? <ErrorState title="Accès réservé" message="Les dérogations sont réservées aux coachs, au coordinateur et aux administrateurs du club." /> : null}
      {detail.error ? <ErrorState title={detail.error instanceof ApiError && detail.error.status === 404 ? "Demande introuvable" : "Chargement impossible"} message={humanMessage(detail.error)} onRetry={() => void detail.refetch()} /> : null}
      {detail.data && context.data && as ? <Thread as={as} request={detail.data} timezone={context.data.timezone} venues={context.data.venues} justSent={sent === "1"} /> : null}
    </Screen>
  );
}

function Thread({ as, request, timezone, venues, justSent }: { as: string; request: DerogationDetail; timezone: string; venues: ClubVenue[]; justSent: boolean }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(justSent ? "Demande envoyée au coordinateur." : null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  const applied = (next: DerogationDetail, message: string) => {
    queryClient.setQueryData(queryKeys.derogation(club.clubSlug, request.id), next);
    void queryClient.invalidateQueries({ queryKey: queryKeys.derogations(club.clubSlug) });
    setToast(message);
  };
  const act = useMutation({
    mutationFn: (v: { action: DerogationAction; message?: string }) => derogationsApi.action(club.clubSlug, as, request.id, v.action, v.message ?? null),
    onSuccess: (next, v) => {
      applied(next, TOASTS[v.action]);
      setChangeOpen(false);
    },
  });
  const send = useMutation({ mutationFn: (body: string) => derogationsApi.message(club.clubSlug, as, request.id, body), onSuccess: (next) => applied(next, "Message envoyé.") });

  const actions = request.permissions.actions;
  const managerActions = actions.filter((a) => a !== "CANCEL");
  const active = isActive(request.status);
  const previous = request.proposals.slice(0, -1).reverse();
  const o = request.officialSchedule;
  const cancel = () =>
    Alert.alert("Annuler la demande ?", "Le coordinateur verra que la demande est annulée. Tu pourras en refaire une ensuite.", [
      { text: "Retour", style: "cancel" },
      { text: "Annuler la demande", style: "destructive", onPress: () => act.mutate({ action: "CANCEL" }) },
    ]);

  return (
    <View style={styles.page}>
      {toast ? <Banner tone="success" message={toast} /> : null}
      <Card style={[styles.gap, { borderColor: accent.accent, borderWidth: 1 }]}>
        <MatchHeadline match={request.match} timezone={timezone} trailing={<RequestStatusBadge status={request.status} />} />
        <View style={styles.slotBox}>
          <AppText variant="eyebrow" tone="subtle">
            Créneau demandé
          </AppText>
          <AppText variant="headline">{`${formatDayLongCapitalized(request.requestedStartAt, timezone)} · ${formatTime(request.requestedStartAt, timezone)} → ${formatTime(request.requestedEndAt, timezone)}`}</AppText>
          <View style={styles.inline}>
            <Ionicons name="location-outline" size={13} color={colors.muted} />
            <AppText variant="meta" tone="muted" style={styles.flex}>
              {request.requestedVenue?.name ?? "À l'extérieur — à confirmer avec le club adverse"}
            </AppText>
          </View>
          <View style={styles.inline}>
            <Ionicons name="person-outline" size={13} color={colors.muted} />
            <AppText variant="meta" tone="muted" style={styles.flex}>{`Demande formulée par : ${request.requesterDisplayName}`}</AppText>
          </View>
          {request.permissions.canPropose ? <Button label="Proposer un autre créneau" variant="secondary" icon={<Ionicons name="repeat-outline" size={18} color={colors.foreground} />} onPress={() => setProposeOpen(true)} /> : null}
        </View>
        {o.changedSinceRequest ? (
          <Banner tone={o.matchesCurrentProposal ? "success" : "info"} message={`Le calendrier FFBB indique désormais : ${formatShortDateTime(o.currentScheduledAt, timezone)}.${o.matchesCurrentProposal ? " Calendrier mis à jour." : ""}`} />
        ) : null}
        {request.match.isHome === false && active ? (
          <AppText variant="meta" tone="muted">
            {AWAY_NOTICE}
          </AppText>
        ) : null}
        {previous.length > 0 ? (
          <View style={styles.gapSm}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showPrevious }} onPress={() => setShowPrevious(!showPrevious)} style={styles.inline}>
              <Ionicons name="time-outline" size={14} color={colors.muted} />
              <AppText variant="meta" tone="muted">{`Créneaux proposés précédemment (${previous.length})`}</AppText>
            </Pressable>
            {showPrevious
              ? previous.map((p) => (
                  <AppText key={p.id} variant="meta" tone="muted">
                    <AppText variant="meta" tone="muted" style={styles.strike}>{`${formatShortDateTime(p.requestedStartAt, timezone)} – ${p.venue?.name ?? "extérieur"}`}</AppText>
                    {` · par ${p.proposedByDisplayName}`}
                  </AppText>
                ))
              : null}
          </View>
        ) : null}
        {managerActions.length > 0 || actions.includes("CANCEL") ? (
          <View style={styles.actions}>
            {managerActions.includes("TAKE_IN_CHARGE") ? <Button label={ACTION_LABELS.TAKE_IN_CHARGE} loading={act.isPending && act.variables?.action === "TAKE_IN_CHARGE"} onPress={() => act.mutate({ action: "TAKE_IN_CHARGE" })} /> : null}
            {managerActions.includes("COMPLETE") ? <Button label={ACTION_LABELS.COMPLETE} loading={act.isPending && act.variables?.action === "COMPLETE"} onPress={() => act.mutate({ action: "COMPLETE" })} /> : null}
            {managerActions.includes("REQUEST_CHANGE") ? <Button label={ACTION_LABELS.REQUEST_CHANGE} variant="secondary" onPress={() => setChangeOpen(true)} /> : null}
            {actions.includes("CANCEL") ? <Button label={ACTION_LABELS.CANCEL} variant="ghost" loading={act.isPending && act.variables?.action === "CANCEL"} onPress={cancel} /> : null}
          </View>
        ) : null}
        {request.permissions.canSubmitOfficial ? (
          <View style={styles.gapSm}>
            <AppText variant="meta" tone="muted">
              Demande officielle : envoie la dérogation à la FFBB (FBI) avec la nouvelle date et l&apos;horaire déjà remplis. Puis « Marquer comme traitée ».
            </AppText>
            <OfficialDerogationForm
              openLabel="Faire la demande officielle (FBI)"
              initial={officialPrefill(request, timezone)}
              submit={async (body) => {
                const result = await derogationsApi.official(club.clubSlug, as, request.id, body);
                queryClient.setQueryData(queryKeys.derogation(club.clubSlug, request.id), result.request);
                if (result.outcome === "success") setToast("Demande officielle envoyée à la FFBB.");
                return { outcome: result.outcome, message: result.message };
              }}
            />
          </View>
        ) : null}
        {managerActions.includes("COMPLETE") ? (
          <AppText variant="meta" tone="muted">
            « Marquer comme traitée » indique seulement que tu as fait les démarches : le calendrier officiel se mettra à jour via la synchronisation FFBB.
          </AppText>
        ) : null}
      </Card>

      {act.error && !changeOpen ? <Banner tone="danger" message={humanMessage(act.error)} /> : null}

      <AppText variant="title">Conversation</AppText>
      {request.messages.map((m) =>
        m.type === "SYSTEM" ? (
          <View key={m.id} style={styles.system}>
            <Ionicons name="ellipse-outline" size={12} color={colors.subtle} style={styles.dot} />
            <AppText variant="meta" tone="muted" style={styles.flex}>
              {m.body}
            </AppText>
            <AppText variant="meta" tone="subtle">
              {formatShortDateTime(m.createdAt, timezone)}
            </AppText>
          </View>
        ) : (
          <View key={m.id} style={[styles.msgRow, m.isMine && styles.mine]}>
            {m.isMine ? null : <Avatar firstName={m.authorDisplayName} size={28} />}
            <View style={[styles.msgCol, m.isMine && styles.alignEnd]}>
              <AppText variant="meta" tone="subtle">{`${m.isMine ? "Toi" : m.authorDisplayName}${m.authorRoleLabel && !m.isMine ? ` · ${m.authorRoleLabel}` : ""} · ${formatShortDateTime(m.createdAt, timezone)}`}</AppText>
              <View style={[styles.bubble, m.isMine ? { backgroundColor: accent.soft, borderBottomRightRadius: 6 } : styles.theirs]}>
                <AppText variant="body">{m.body}</AppText>
              </View>
            </View>
          </View>
        ),
      )}

      {request.permissions.canMessage ? (
        <Composer busy={send.isPending} onSend={(body) => send.mutateAsync(body).then(() => true, () => false)} />
      ) : (
        <AppText variant="meta" tone="muted" style={styles.center}>
          {active ? "Tu peux lire cette conversation, sans y répondre." : "Conversation close."}
        </AppText>
      )}
      {send.error ? <Banner tone="danger" message={humanMessage(send.error)} /> : null}

      <RequestChangeSheet open={changeOpen} onClose={() => setChangeOpen(false)} busy={act.isPending && act.variables?.action === "REQUEST_CHANGE"} error={act.error ? humanMessage(act.error) : null} onSubmit={(message) => act.mutate({ action: "REQUEST_CHANGE", message })} />
      {request.permissions.canPropose ? (
        <ProposeSheet
          open={proposeOpen}
          onClose={() => setProposeOpen(false)}
          as={as}
          request={request}
          timezone={timezone}
          venues={venues}
          onProposed={(next) => {
            setProposeOpen(false);
            applied(next, "Nouveau créneau envoyé au coordinateur.");
          }}
        />
      ) : null}
    </View>
  );
}

function Composer({ busy, onSend }: { busy: boolean; onSend: (body: string) => Promise<boolean> }) {
  const accent = useClubAccent();
  const [text, setText] = useState("");
  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    if (await onSend(body)) setText("");
  };
  return (
    <View style={styles.composer}>
      <TextInput value={text} onChangeText={setText} placeholder="Écrire un message…" placeholderTextColor={colors.subtle} multiline maxLength={3000} accessibilityLabel="Écrire un message" maxFontSizeMultiplier={MAX_FONT_SCALE} style={styles.composerInput} />
      <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le message" disabled={!text.trim() || busy} onPress={() => void submit()} style={[styles.sendBtn, { backgroundColor: accent.accent }, (!text.trim() || busy) && styles.disabled]}>
        <Ionicons name="send" size={18} color={accent.ink} />
      </Pressable>
    </View>
  );
}

function RequestChangeSheet({ open, onClose, busy, error, onSubmit }: { open: boolean; onClose: () => void; busy: boolean; error: string | null; onSubmit: (message: string) => void }) {
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = !message.trim();
  return (
    <Sheet visible={open} title="Ce n'est pas possible" onClose={onClose}>
      <AppText variant="callout" tone="muted">
        Explique pourquoi : le coach verra ton message et pourra proposer un autre créneau.
      </AppText>
      <TextField label="Message au coach" value={message} onChangeText={setMessage} multiline maxLength={3000} placeholder="Ex. : le gymnase est réservé pour un tournoi ce week-end-là." error={touched && missing ? "Un message est obligatoire." : null} />
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button
        label="Demander un autre créneau"
        loading={busy}
        onPress={() => {
          setTouched(true);
          if (!missing) onSubmit(message.trim());
        }}
        fullWidth
      />
    </Sheet>
  );
}

function ProposeSheet({ open, onClose, as, request, timezone, venues, onProposed }: { open: boolean; onClose: () => void; as: string; request: DerogationDetail; timezone: string; venues: ClubVenue[]; onProposed: (next: DerogationDetail) => void }) {
  const club = useActiveClub();
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotSelection | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!slot) return;
    setSending(true);
    setError(null);
    try {
      const next = await derogationsApi.propose(club.clubSlug, as, request.id, { requestedStartAt: slot.startAt, requestedVenueId: slot.venueId, message: message.trim() || null });
      setDate(null);
      setSlot(null);
      setMessage("");
      onProposed(next);
    } catch (err) {
      if (err instanceof ApiError && err.code === "DEROGATION_SLOT_CONFLICT") setSlot(null);
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer ce créneau pour le moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Sheet visible={open} title="Proposer un autre créneau" onClose={onClose}>
      <AppText variant="callout" tone="muted">
        Le coordinateur recevra le nouveau créneau dans la conversation.
      </AppText>
      {error ? <Banner tone="danger" message={error} /> : null}
      <DateChooser
        timezone={timezone}
        value={date}
        onChange={(d) => {
          if (d !== date) setSlot(null);
          setDate(d);
        }}
      />
      {date ? <SlotChooser as={as} matchId={request.match.id} date={date} timezone={timezone} venues={venues} value={slot} onChange={setSlot} /> : null}
      <TextField label="Message (facultatif)" value={message} onChangeText={setMessage} multiline maxLength={3000} />
      <Button label={slot ? `Proposer ${slot.localStart}` : "Choisis un créneau"} loading={sending} disabled={!slot} onPress={() => void submit()} fullWidth />
    </Sheet>
  );
}

/** Pré-remplissage de la demande officielle FBI (comme le web) : date / horaire cochés seulement s'ils changent vraiment. */
function officialPrefill(request: DerogationDetail, timezone: string): Partial<OfficialFormState> {
  const current = request.officialSchedule.currentScheduledAt ?? request.originalScheduledAt;
  const newDate = localDateKey(new Date(request.requestedStartAt), timezone);
  const newTime = formatTime(request.requestedStartAt, timezone);
  const sameDate = current ? localDateKey(new Date(current), timezone) === newDate : false;
  const sameTime = current ? formatTime(current, timezone) === newTime : false;
  return { modifierDate: !sameDate, dateDerogation: newDate, modifierHoraire: !sameTime, horaire: newTime };
}

const styles = StyleSheet.create({
  page: { gap: spacing.md },
  gap: { gap: spacing.md },
  gapSm: { gap: spacing.sm },
  flex: { flex: 1 },
  center: { textAlign: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  strike: { textDecorationLine: "line-through" },
  slotBox: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  actions: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  system: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, paddingHorizontal: spacing.xs },
  dot: { marginTop: 3 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  mine: { flexDirection: "row-reverse" },
  msgCol: { maxWidth: "85%", gap: 4 },
  alignEnd: { alignItems: "flex-end" },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 16 },
  theirs: { backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderBottomLeftRadius: 6 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  composerInput: { flex: 1, minHeight: 44, maxHeight: 160, ...typography.body, color: colors.foreground, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.4 },
});
