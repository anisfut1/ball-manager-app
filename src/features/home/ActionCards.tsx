import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ActionCenterAction } from "@/api/endpoints/teamLife";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { ActionCard, AppText, Badge, Banner, Button, ChoiceGroup } from "@/components/ui";
import { colors, spacing } from "@/design";
import { formatTime, relativeDay, relativeDayTime } from "@/lib/dates";
import { AVAILABILITY_CHOICES, CONVOCATION_CHOICES, matchTitle, TRAINING_CHOICES } from "@/features/team-life/labels";
import { isPending, personLabel } from "./action-center-model";
import type { OptimisticAnswer } from "./action-center-model";

type Answer = (a: OptimisticAnswer) => void;

function Line({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <AppText variant="callout" tone="muted" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

export function ActionItem({ action, answer, disabled }: { action: ActionCenterAction; answer: Answer; disabled: boolean }) {
  const club = useActiveClub();
  const tz = club.timezone;
  switch (action.type) {
    case "TRAINING_RESPONSE": {
      const t = action.training;
      return (
        <ActionCard eyebrow={personLabel(action.firstName, t.team.name)} title={`Entraînement ${relativeDayTime(t.startsAt, tz).toLowerCase()}`} pending={isPending(action)} onPress={() => router.push(`/c/${club.clubSlug}/entrainements/${t.id}`)}>
          {t.location.label ? <Line icon="location-outline" text={t.location.label} /> : null}
          <ChoiceGroup accessibilityLabel={`Présence de ${action.firstName}`} choices={TRAINING_CHOICES} value={action.currentResponse} disabled={disabled} onChange={(response) => answer({ kind: "training", occurrenceId: t.id, licencieId: action.licencieId, response })} />
        </ActionCard>
      );
    }
    case "MATCH_AVAILABILITY": {
      const m = action.match;
      return (
        <ActionCard eyebrow={personLabel(action.firstName, m.team.name)} title={`Match ${m.startsAt ? relativeDay(m.startsAt, tz).toLowerCase() : ""} · ${matchTitle(m.team.name, m.opponent, m.isHome)}`} pending={isPending(action)} onPress={() => router.push(`/c/${club.clubSlug}/matchs/${m.id}`)}>
          <AppText variant="callout">{action.firstName} est disponible ?</AppText>
          {action.reminded && !action.currentResponse ? <Badge tone="warning" label="Le coach attend ta réponse" /> : null}
          <ChoiceGroup accessibilityLabel={`Disponibilité de ${action.firstName}`} choices={AVAILABILITY_CHOICES} value={action.currentResponse} disabled={disabled} onChange={(response) => answer({ kind: "availability", matchId: m.id, licencieId: action.licencieId, response })} />
        </ActionCard>
      );
    }
    case "CONVOCATION_RESPONSE": {
      const m = action.match;
      const c = action.convocation;
      const away = m.isHome === false;
      return (
        <ActionCard eyebrow={`Convocation pour ${action.firstName}`} title={matchTitle(m.team.name, m.opponent, m.isHome)} pending={isPending(action)} onPress={() => router.push(`/c/${club.clubSlug}/matchs/${m.id}?section=convocation`)}>
          {m.startsAt ? <Line icon="basketball-outline" text={`Match ${relativeDayTime(m.startsAt, tz).toLowerCase()}`} /> : null}
          {c.meetingAt ? <Line icon="time-outline" text={`RDV ${formatTime(c.meetingAt, tz)}${c.meetingPoint ? ` · ${c.meetingPoint}` : ""}`} /> : null}
          {away && m.venueName ? <Line icon="location-outline" text={`Match à ${m.venueName}`} /> : null}
          {c.coachMessage ? <AppText variant="callout">« {c.coachMessage} »</AppText> : null}
          {action.reminded && action.currentResponse === "PENDING" ? <Badge tone="warning" label="Le coach attend ta réponse" /> : null}
          {action.matchClosed ? (
            <Banner tone="warning" message="Match annulé ou reporté : plus de confirmation possible." />
          ) : (
            <ChoiceGroup accessibilityLabel={`Convocation de ${action.firstName}`} choices={CONVOCATION_CHOICES} value={action.currentResponse === "PENDING" ? null : action.currentResponse} disabled={disabled} onChange={(response) => answer({ kind: "convocation", matchId: m.id, licencieId: action.licencieId, response })} />
          )}
        </ActionCard>
      );
    }
    case "LAUNDRY_DUTY": {
      const m = action.match;
      return (
        <ActionCard eyebrow={personLabel(action.firstName, m.team.name)} title="Maillots : c'est ton tour" pending={isPending(action)}>
          <AppText variant="callout" tone="muted">
            Lavage des maillots après {matchTitle(m.team.name, m.opponent, m.isHome)}
            {m.startsAt ? ` (${relativeDay(m.startsAt, tz).toLowerCase()})` : ""}.
          </AppText>
          {action.seenAt ? <Badge tone="success" label="C'est noté" /> : <Button label="J'ai vu" variant="secondary" disabled={disabled} onPress={() => answer({ kind: "laundry-seen", matchId: m.id, licencieId: action.licencieId, at: new Date().toISOString() })} />}
        </ActionCard>
      );
    }
    case "COACH_MATCH":
      return <CoachMatchCard action={action} />;
    case "COACH_TRAINING_SUMMARY": {
      const t = action.training;
      const c = t.counts;
      return (
        <ActionCard eyebrow={`Coach · ${t.team.name}`} title={`Entraînement ${relativeDayTime(t.startsAt, tz).toLowerCase()}`} onPress={() => router.push(`/c/${club.clubSlug}/entrainements/${t.id}`)}>
          {t.status === "cancelled" ? <Badge tone="danger" label="Annulé" /> : null}
          {c ? <AppText variant="callout">{`${c.present} présent·e·s · ${c.absent} absent·e·s · ${c.uncertain} incertain·e·s · ${c.noResponse} sans réponse`}</AppText> : null}
        </ActionCard>
      );
    }
  }
}

/** Coach : un match, où il en est, et l'action suivante en un geste. */
function CoachMatchCard({ action }: { action: Extract<ActionCenterAction, { type: "COACH_MATCH" }> }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const m = action.match;
  const as = action.coachLicencieId;
  const open = useMutation({
    mutationFn: () => (action.stage === "ASK_AVAILABILITY" ? teamLifeApi.openAvailability(club.clubSlug, as, m.id) : teamLifeApi.remind(club.clubSlug, as, m.id)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) }),
  });
  const a = action.availabilityCounts;
  const c = action.convocationCounts;
  return (
    <ActionCard eyebrow={`Coach · ${m.team.name}`} title={`${matchTitle(m.team.name, m.opponent, m.isHome)}${m.startsAt ? ` · ${relativeDay(m.startsAt, club.timezone).toLowerCase()}` : ""}`} pending={isPending(action)} onPress={() => router.push(`/c/${club.clubSlug}/matchs/${m.id}?section=coach`)}>
      {action.matchChanged ? <Banner tone="warning" message="Le match a changé depuis l'envoi de la convocation." /> : null}
      {action.stage === "ASK_AVAILABILITY" ? (
        <Button label="Demander les disponibilités" loading={open.isPending} onPress={() => open.mutate()} />
      ) : action.stage === "PREPARE_CONVOCATION" ? (
        <>
          {a ? <AppText variant="callout">{`${a.available} disponibles · ${a.noResponse} sans réponse`}</AppText> : null}
          <Button label="Préparer la convocation" onPress={() => router.push(`/c/${club.clubSlug}/matchs/${m.id}/convocation`)} />
        </>
      ) : (
        <>
          <AppText variant="callout">{c ? `Convocation envoyée · ${c.confirmed} confirmé·e·s · ${c.declined} refus · ${c.pending} en attente` : "Convocation envoyée"}</AppText>
          {c && c.pending > 0 ? <Button label="Relancer les sans réponse" variant="secondary" loading={open.isPending} onPress={() => open.mutate()} /> : null}
        </>
      )}
      {!action.laundryAssigned ? (
        <View style={styles.row}>
          <AppText variant="callout" style={styles.flex}>
            Maillots · à attribuer
          </AppText>
          <Button label="Choisir" variant="ghost" onPress={() => router.push(`/c/${club.clubSlug}/matchs/${m.id}?section=maillots`)} />
        </View>
      ) : null}
      {action.tables ? (
        <View style={styles.row}>
          <AppText variant="callout" style={styles.flex}>{`Table de marque · ${action.tables.filled}/${action.tables.total}`}</AppText>
          {action.tables.filled < action.tables.total ? <Button label="Compléter" variant="ghost" onPress={() => router.push(`/c/${club.clubSlug}/tables`)} /> : null}
        </View>
      ) : null}
      {open.error ? <Banner tone="danger" message={humanMessage(open.error)} /> : null}
    </ActionCard>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
