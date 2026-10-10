import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi, type MatchTeamLifeDto } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Banner, Button, Card, ListRow, SectionHeader, type BadgeTone } from "@/components/ui";
import { spacing } from "@/design";
import { formatTime } from "@/lib/dates";
import { LaundrySheet } from "./LaundrySheet";

const AVAIL: Record<string, { label: string; tone: BadgeTone }> = { AVAILABLE: { label: "Disponible", tone: "success" }, UNAVAILABLE: { label: "Indisponible", tone: "danger" }, UNCERTAIN: { label: "Incertain·e", tone: "warning" } };
const CONVOC: Record<string, { label: string; tone: BadgeTone }> = { CONFIRMED: { label: "Confirmé·e", tone: "success" }, DECLINED: { label: "Ne vient pas", tone: "danger" }, PENDING: { label: "En attente", tone: "neutral" } };

/** Coach : disponibilités (avec « sans réponse »), convocation, maillots. */
export function CoachMatchPanel({ data, as, openLaundry = false }: { data: MatchTeamLifeDto; as: string; openLaundry?: boolean }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const [laundryOpen, setLaundryOpen] = useState(openLaundry);
  const matchId = data.match.id;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.matchTeamLife(club.clubSlug, matchId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
  };
  const open = useMutation({ mutationFn: () => teamLifeApi.openAvailability(club.clubSlug, as, matchId), onSuccess: refresh });
  const remind = useMutation({ mutationFn: () => teamLifeApi.remind(club.clubSlug, as, matchId), onSuccess: refresh });
  const a = data.availability;
  const c = data.convocation;
  const sent = c?.sent ?? null;
  const error = open.error ?? remind.error;

  return (
    <View style={styles.box}>
      <SectionHeader title="Coach" />
      {error ? <Banner tone="danger" message={humanMessage(error)} /> : null}
      {data.matchClosed ? <Banner tone="warning" message="Match passé, annulé ou reporté : plus de demande ni de confirmation." /> : null}

      <Card>
        <AppText variant="headline">Disponibilités</AppText>
        {a.openedAt ? (
          <>
            <AppText variant="callout">{`${a.counts.available} disponibles · ${a.counts.unavailable} indisponibles · ${a.counts.uncertain} incertain·e·s · ${a.counts.noResponse} sans réponse`}</AppText>
            {a.roster.map((r) => (
              <ListRow key={r.licencie.id} title={`${r.licencie.firstName} ${r.licencie.lastName}`} leading={<Avatar firstName={r.licencie.firstName} lastName={r.licencie.lastName} photoUrl={r.licencie.photoUrl} />} trailing={<Badge tone={r.response ? (AVAIL[r.response]?.tone ?? "neutral") : "neutral"} label={r.response ? (AVAIL[r.response]?.label ?? r.response) : "Sans réponse"} />} />
            ))}
            {!sent && a.counts.noResponse > 0 && !data.matchClosed ? <Button label="Relancer les sans réponse" variant="secondary" loading={remind.isPending} onPress={() => remind.mutate()} /> : null}
          </>
        ) : (
          <>
            <AppText variant="callout" tone="muted">
              Les familles répondront Disponible / Indisponible / Incertain depuis leur accueil. Aucune convocation n&apos;est créée à cette étape.
            </AppText>
            {!data.matchClosed ? <Button label="Demander les disponibilités" loading={open.isPending} onPress={() => open.mutate()} /> : null}
          </>
        )}
      </Card>

      <Card>
        <AppText variant="headline">Convocation</AppText>
        {c && sent ? (
          <>
            <AppText variant="callout">{`${c.counts.convoked} convoqué·e·s · ${c.counts.confirmed} confirmé·e·s · ${c.counts.declined} refus · ${c.counts.pending} en attente`}</AppText>
            {sent.meetingAt ? <AppText variant="callout" tone="muted">{`RDV ${formatTime(sent.meetingAt, club.timezone)}${sent.meetingPoint ? ` · ${sent.meetingPoint}` : ""}`}</AppText> : null}
            {c.matchChanges.length ? <Banner tone="warning" message="Le match a changé depuis l'envoi (date, lieu ou statut) : envoie une mise à jour." /> : null}
            {c.recipients.map((r) => (
              <ListRow key={r.licencie.id} title={`${r.licencie.firstName} ${r.licencie.lastName}`} leading={<Avatar firstName={r.licencie.firstName} lastName={r.licencie.lastName} photoUrl={r.licencie.photoUrl} />} trailing={<Badge tone={CONVOC[r.response]?.tone ?? "neutral"} label={CONVOC[r.response]?.label ?? r.response} />} />
            ))}
            {c.counts.pending > 0 && !data.matchClosed ? <Button label="Relancer les en attente" variant="secondary" loading={remind.isPending} onPress={() => remind.mutate()} /> : null}
            {!data.matchClosed ? <Button label={c.hasUnsentChanges || c.matchChanges.length ? "Modifier et renvoyer" : "Modifier la convocation"} variant="ghost" onPress={() => router.push(`/c/${club.clubSlug}/matchs/${matchId}/convocation`)} /> : null}
          </>
        ) : !data.matchClosed ? (
          <Button label="Préparer la convocation" onPress={() => router.push(`/c/${club.clubSlug}/matchs/${matchId}/convocation`)} />
        ) : (
          <AppText variant="callout" tone="muted">
            Aucune convocation envoyée.
          </AppText>
        )}
      </Card>

      <Card>
        <AppText variant="headline">Maillots</AppText>
        {data.laundry.assignee ? (
          <ListRow title={data.laundry.assignee.label} subtitle={data.laundry.assignee.seenAt ? "A vu la demande" : "Pas encore vu"} trailing={<Button label="Changer" variant="ghost" onPress={() => setLaundryOpen(true)} />} />
        ) : (
          <View style={styles.row}>
            <AppText variant="callout" tone="muted" style={styles.flex}>
              À attribuer
            </AppText>
            <Button label="Choisir" variant="secondary" onPress={() => setLaundryOpen(true)} />
          </View>
        )}
      </Card>
      <LaundrySheet visible={laundryOpen} onClose={() => setLaundryOpen(false)} matchId={matchId} as={as} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.md }, row: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, flex: { flex: 1 } });
