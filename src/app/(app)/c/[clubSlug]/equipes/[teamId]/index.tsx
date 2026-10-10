import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Button, Card, CardSkeletons, EmptyState, ErrorState, ListRow, Screen, SegmentedControl } from "@/components/ui";
import { spacing } from "@/design";
import { groupByDay } from "@/features/planning/planning-model";
import { useTeamOverview } from "@/features/team/useTeamOverview";
import { matchTitle } from "@/features/team-life/labels";
import { addDaysKey, dayKey, formatTime, relativeDayTime } from "@/lib/dates";

type Tab = "overview" | "planning" | "roster";

/** Équipe : Vue d'ensemble / Planning / Effectif — trois onglets, pas quinze. */
export default function TeamScreen() {
  const { teamId = "", tab } = useLocalSearchParams<{ teamId: string; tab?: string }>();
  const club = useActiveClub();
  const [current, setCurrent] = useState<Tab>(tab === "planning" ? "planning" : tab === "effectif" ? "roster" : "overview");
  const overview = useTeamOverview(teamId);
  const data = overview.data?.data;
  const teams = useQuery({ queryKey: queryKeys.teams(club.clubSlug), queryFn: () => teamLifeApi.teams(club.clubSlug), staleTime: 10 * 60_000 });
  const name = data?.team.name ?? teams.data?.teams.find((t) => t.id === teamId)?.name ?? "Équipe";
  const today = dayKey(new Date(), club.timezone);
  const people = club.people.map((p) => p.licencieId);
  const planning = useQuery({ queryKey: [...queryKeys.planning(club.clubSlug, today, addDaysKey(today, 41)), ...people], queryFn: () => teamLifeApi.planning(club.clubSlug, people, today, addDaysKey(today, 41)), enabled: current === "planning" });
  const sections = useMemo(() => groupByDay((planning.data?.events ?? []).filter((e) => e.team?.id === teamId), club.timezone), [planning.data, teamId, club.timezone]);

  return (
    <Screen refreshing={overview.isRefetching} onRefresh={() => void overview.refetch()}>
      <Stack.Screen options={{ headerShown: true, title: name, headerBackTitle: "Équipes" }} />
      <SegmentedControl
        value={current}
        onChange={setCurrent}
        options={[
          { value: "overview", label: "Vue d'ensemble" },
          { value: "planning", label: "Planning" },
          { value: "roster", label: "Effectif" },
        ]}
      />
      {overview.isPending ? <CardSkeletons count={2} /> : null}
      {overview.error ? <ErrorState message={humanMessage(overview.error)} onRetry={() => void overview.refetch()} /> : null}
      {overview.data === null || (!overview.isPending && !overview.data) ? <EmptyState icon="lock-closed-outline" title="Réservé à l'équipe" message="Les joueurs de l'équipe, leurs parents et les coachs voient cette page." /> : null}

      {data && current === "overview" ? (
        <View style={styles.box}>
          <Card>
            <AppText variant="eyebrow" tone="subtle">
              Prochain match
            </AppText>
            {data.nextMatch ? (
              <>
                <AppText variant="headline" onPress={() => router.push(`/c/${club.clubSlug}/matchs/${data.nextMatch!.id}`)}>
                  {matchTitle(name, data.nextMatch.opponent, data.nextMatch.isHome)}
                </AppText>
                {data.nextMatch.startsAt ? <AppText variant="callout" tone="muted">{relativeDayTime(data.nextMatch.startsAt, club.timezone)}</AppText> : null}
                {data.nextMatch.availability?.open ? <AppText variant="callout">{`${data.nextMatch.availability.noResponse} sans réponse aux disponibilités`}</AppText> : null}
                {data.nextMatch.convocation?.sent ? <AppText variant="callout">{`Convocation : ${data.nextMatch.convocation.confirmed}/${data.nextMatch.convocation.convoked} confirmé·e·s`}</AppText> : null}
                <Button label="Voir le match" variant="secondary" onPress={() => router.push(`/c/${club.clubSlug}/matchs/${data.nextMatch!.id}${data.canManage ? "?section=coach" : ""}`)} />
              </>
            ) : (
              <AppText variant="callout" tone="muted">
                Aucun match à venir.
              </AppText>
            )}
          </Card>
          <Card>
            <AppText variant="eyebrow" tone="subtle">
              Prochain entraînement
            </AppText>
            {data.nextTraining ? (
              <ListRow title={relativeDayTime(data.nextTraining.startsAt, club.timezone)} subtitle={data.nextTraining.location.label} onPress={() => router.push(`/c/${club.clubSlug}/entrainements/${data.nextTraining!.id}`)} />
            ) : (
              <AppText variant="callout" tone="muted">
                Aucun entraînement prévu.
              </AppText>
            )}
            {data.canManage ? <Button label="Planifier les entraînements" variant="secondary" onPress={() => router.push(`/c/${club.clubSlug}/equipes/${teamId}/creneaux`)} /> : null}
          </Card>
        </View>
      ) : null}

      {data && current === "planning" ? (
        <View style={styles.box}>
          {planning.isPending ? <CardSkeletons count={2} /> : null}
          {sections.length === 0 && !planning.isPending ? <EmptyState icon="calendar-outline" title="Rien de prévu" message="Aucun match ni entraînement sur les six prochaines semaines." /> : null}
          {sections.map((s) => (
            <View key={s.key} style={styles.box}>
              <AppText variant="eyebrow" tone="subtle">
                {s.title}
              </AppText>
              {s.data.map((e) => (
                <Card key={`${e.kind}:${e.id}`} style={styles.item}>
                  <ListRow title={e.title} subtitle={[formatTime(e.startsAt, club.timezone), e.location].filter(Boolean).join(" · ")} trailing={e.status === "cancelled" ? <Badge tone="danger" label="Annulé" /> : undefined} onPress={() => router.push(e.kind === "MATCH" ? `/c/${club.clubSlug}/matchs/${e.id}` : `/c/${club.clubSlug}/entrainements/${e.id}`)} />
                </Card>
              ))}
            </View>
          ))}
          {data.canManage ? <Button label="Planifier les entraînements" variant="secondary" onPress={() => router.push(`/c/${club.clubSlug}/equipes/${teamId}/creneaux`)} /> : null}
        </View>
      ) : null}

      {data && current === "roster" ? (
        <Card padded={false} style={styles.list}>
          {data.roster.map((r) => (
            <ListRow
              key={r.licencie.id}
              title={`${r.licencie.firstName} ${r.licencie.lastName}`}
              subtitle={r.attendance && r.attendance.sessions > 0 ? `${r.attendance.absent} absence${r.attendance.absent > 1 ? "s" : ""} · ${r.attendance.late} retard${r.attendance.late > 1 ? "s" : ""} sur ${r.attendance.sessions} séances` : null}
              leading={<Avatar firstName={r.licencie.firstName} lastName={r.licencie.lastName} photoUrl={r.licencie.photoUrl} />}
              trailing={r.isCoach ? <Badge tone="info" label="Coach" /> : r.hasPersonalLink === false ? <Badge label="Sans lien" /> : undefined}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.md }, list: { paddingHorizontal: spacing.lg }, item: { paddingVertical: 0 } });
