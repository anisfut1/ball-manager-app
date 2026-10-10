import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { derogationsApi, type DerogationAction } from "@/api/endpoints/derogations";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, ErrorState, Screen, SectionHeader, Sheet, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ACTIONS, STATUS } from "@/features/derogations/labels";
import { useDerogationActor } from "@/features/derogations/useDerogationActor";
import { dayKey, formatTime, relativeDayTime, zonedToUtcIso } from "@/lib/dates";

/** Demande : statut, créneau demandé, propositions, conversation, actions autorisées par l'API. */
export default function DerogationScreen() {
  const { requestId = "" } = useLocalSearchParams<{ requestId: string }>();
  const club = useActiveClub();
  const accent = useClubAccent();
  const as = useDerogationActor();
  const queryClient = useQueryClient();
  const tz = club.timezone;
  const detail = useQuery({ queryKey: queryKeys.derogation(club.clubSlug, requestId), queryFn: () => derogationsApi.detail(club.clubSlug, as!, requestId), enabled: !!as });
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<DerogationAction | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposal, setProposal] = useState({ date: "", time: "", message: "" });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.derogation(club.clubSlug, requestId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.derogations(club.clubSlug) });
  };
  const send = useMutation({ mutationFn: () => derogationsApi.message(club.clubSlug, as!, requestId, message.trim()), onSuccess: () => (setMessage(""), refresh()) });
  const act = useMutation({ mutationFn: (a: DerogationAction) => derogationsApi.action(club.clubSlug, as!, requestId, a, actionMessage.trim() || null), onSuccess: () => (setPendingAction(null), setActionMessage(""), refresh()) });
  const propose = useMutation({ mutationFn: () => derogationsApi.propose(club.clubSlug, as!, requestId, { requestedStartAt: zonedToUtcIso(proposal.date, proposal.time, tz), message: proposal.message.trim() || null }), onSuccess: () => (setProposeOpen(false), refresh()) });
  const d = detail.data;
  const error = send.error ?? act.error ?? propose.error;

  return (
    <Screen refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
      <Stack.Screen options={{ headerShown: true, title: "Dérogation", headerBackTitle: "Retour" }} />
      {detail.isPending ? <CardSkeletons count={2} /> : null}
      {detail.error ? <ErrorState message={humanMessage(detail.error)} onRetry={() => void detail.refetch()} /> : null}
      {d ? (
        <>
          <Card>
            <Badge tone={STATUS[d.status].tone} label={STATUS[d.status].label} />
            <AppText variant="headline">{`${d.match.teamName ?? ""} vs ${d.match.opponentName ?? ""}`}</AppText>
            {d.originalScheduledAt ? <AppText variant="callout" tone="muted">{`Prévu : ${relativeDayTime(d.originalScheduledAt, tz)}`}</AppText> : null}
            <AppText variant="bodyStrong">{`Demandé : ${relativeDayTime(d.requestedStartAt, tz)}${d.requestedVenue ? ` · ${d.requestedVenue.name}` : ""}`}</AppText>
            <AppText variant="meta" tone="subtle">{`Par ${d.requesterDisplayName}`}</AppText>
            {d.officialSchedule.changedSinceRequest ? <Banner tone="info" message={d.officialSchedule.matchesCurrentProposal ? "Le calendrier officiel correspond maintenant à la demande." : "Le calendrier officiel a changé depuis la demande."} /> : null}
          </Card>
          {error ? <Banner tone="danger" message={humanMessage(error)} /> : null}
          {d.permissions.actions.length || d.permissions.canPropose ? (
            <View style={styles.actions}>
              {d.permissions.actions.map((a) => (
                <Button key={a} label={ACTIONS[a].label} variant={ACTIONS[a].variant} loading={act.isPending && act.variables === a} onPress={() => (ACTIONS[a].needsMessage ? setPendingAction(a) : act.mutate(a))} />
              ))}
              {d.permissions.canPropose ? (
                <Button
                  label="Proposer un autre créneau"
                  variant="secondary"
                  onPress={() => {
                    setProposal({ date: dayKey(d.requestedStartAt, tz), time: formatTime(d.requestedStartAt, tz), message: "" });
                    setProposeOpen(true);
                  }}
                />
              ) : null}
            </View>
          ) : null}
          {d.permissions.canSubmitOfficial ? <Banner tone="info" message="La saisie officielle sur FBI se fait depuis le site Ball Manager (jamais automatiquement depuis l'app)." /> : null}

          {d.proposals.length > 1 ? (
            <>
              <SectionHeader title="Créneaux proposés" />
              {d.proposals.map((p) => (
                <AppText key={p.id} variant="callout">{`${relativeDayTime(p.requestedStartAt, tz)}${p.venue ? ` · ${p.venue.name}` : ""} — ${p.proposedByDisplayName}`}</AppText>
              ))}
            </>
          ) : null}

          <SectionHeader title="Conversation" />
          {d.messages.map((msg) =>
            msg.type === "SYSTEM" ? (
              <AppText key={msg.id} variant="meta" tone="subtle" style={styles.system}>
                {msg.body}
              </AppText>
            ) : (
              <View key={msg.id} style={[styles.bubble, msg.isMine ? { alignSelf: "flex-end", backgroundColor: accent.soft } : styles.theirs]}>
                <AppText variant="meta" tone="muted">{`${msg.authorDisplayName}${msg.authorRoleLabel ? ` · ${msg.authorRoleLabel}` : ""}`}</AppText>
                <AppText variant="callout">{msg.body}</AppText>
              </View>
            ),
          )}
          {d.permissions.canMessage ? (
            <Card>
              <TextField label="Message" value={message} onChangeText={setMessage} multiline maxLength={3000} />
              <Button label="Envoyer" loading={send.isPending} disabled={!message.trim()} onPress={() => send.mutate()} />
            </Card>
          ) : null}
        </>
      ) : null}
      <Sheet visible={pendingAction !== null} title="Pas possible" onClose={() => setPendingAction(null)}>
        <AppText variant="callout" tone="muted">
          Explique pourquoi : le coach verra immédiatement la raison.
        </AppText>
        <TextField label="Raison" value={actionMessage} onChangeText={setActionMessage} multiline />
        <Button label="Envoyer" loading={act.isPending} disabled={!actionMessage.trim()} onPress={() => pendingAction && act.mutate(pendingAction)} fullWidth />
      </Sheet>
      <Sheet visible={proposeOpen} title="Autre créneau" onClose={() => setProposeOpen(false)}>
        <TextField label="Date (AAAA-MM-JJ)" value={proposal.date} onChangeText={(date) => setProposal({ ...proposal, date })} keyboardType="numbers-and-punctuation" />
        <TextField label="Heure (HH:MM)" value={proposal.time} onChangeText={(time) => setProposal({ ...proposal, time })} keyboardType="numbers-and-punctuation" maxLength={5} />
        <TextField label="Message (facultatif)" value={proposal.message} onChangeText={(m) => setProposal({ ...proposal, message: m })} multiline />
        <Button label="Proposer" loading={propose.isPending} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(proposal.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(proposal.time)} onPress={() => propose.mutate()} fullWidth />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  system: { textAlign: "center", paddingHorizontal: spacing.lg },
  bubble: { maxWidth: "85%", padding: spacing.md, borderRadius: radius.lg, gap: spacing.xxs },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
