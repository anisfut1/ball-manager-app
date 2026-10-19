import { useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { clubSpaceApi, type HomeRelation, type PublicHomeDto } from "@/api/endpoints/clubSpace";
import { TABLE_ROLES } from "@/api/endpoints/tables";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, Screen, SectionHeader, Sheet } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ActionItem } from "@/features/home/ActionCards";
import { ClubHeader } from "@/features/home/ClubHeader";
import { LicensedSearchCard } from "@/features/licensed-access/LicensedSearchCard";
import { PushInvite } from "@/features/home/PushInvite";
import { actionKey, isPending, sortActions } from "@/features/home/action-center-model";
import { buildAgenda, type AgendaItem } from "@/features/home/agenda";
import { useActionCenter, useAnswer } from "@/features/home/useActionCenter";
import { DayGroups } from "@/features/matches/DayGroups";
import { MatchCard } from "@/features/matches/MatchCard";
import { groupByDay, MATCH_TZ } from "@/features/matches/match-model";
import { useClubInfo } from "@/features/matches/useClubInfo";
import { formatShortDay, formatTime } from "@/lib/dates";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { LicensedGateScreen } from "@/features/licensed-access/LicensedGateScreen";

const RELATION_LABEL: Record<HomeRelation, string> = { COACH: "Tu coaches", PLAYER: "Ton équipe" };

/** Réservé aux licenciés : la porte d'accès tant que personne n'est reconnu pour ce club (comme le web). */
export default function HomeScreen() {
  const { session, switching } = useCurrentClubState();
  return session ? <MemberHome /> : switching ? null : <LicensedGateScreen module="home" />;
}

/**
 * Accueil, même structure que l'accueil du web (PublicHomeApp) : « Bonjour »,
 * équipes et rôles, ce qu'il y a à faire (réponse en un geste), tables de
 * marque, derniers résultats, puis l'agenda. Données réelles uniquement.
 */
function MemberHome() {
  const { person } = useSession();
  const club = useClubInfo();
  const accent = useClubAccent();
  const as = person?.licencieId ?? "";
  const { query: center } = useActionCenter();
  const { answer, pending, error: answerError, clearError } = useAnswer();
  const [addingPerson, setAddingPerson] = useState(false);
  const home = useQuery({ queryKey: queryKeys.home(club.slug, as), queryFn: () => clubSpaceApi.home(club.slug, as), enabled: !!as });
  // Tables tenues cette saison (classement public) : bloc secondaire, une panne n'empêche pas l'accueil.
  const board = useQuery({ queryKey: queryKeys.tableLeaderboard(club.slug), queryFn: () => clubSpaceApi.tableLeaderboard(club.slug), staleTime: 10 * 60_000 });
  const tablesDone = board.data ? (board.data.entries.find((e) => e.licencie.id === as)?.done ?? 0) : null;

  const actions = useMemo(() => sortActions(center.data?.actions ?? []), [center.data]);
  const todo = actions.filter(isPending).length;
  const agenda = useMemo(() => (home.data ? buildAgenda(home.data, center.data) : []), [home.data, center.data]);
  const severalPeople = (center.data?.people.length ?? 0) > 1;
  const base = `/c/${club.slug}`;

  const refreshing = home.isRefetching || center.isRefetching;
  const refresh = () => {
    void home.refetch();
    void center.refetch();
    void board.refetch();
  };

  const data = home.data;
  const coachTeams = data?.teams.filter((t) => t.relation === "COACH") ?? [];
  const playerTeams = data?.teams.filter((t) => t.relation === "PLAYER") ?? [];
  const myTeams = [...coachTeams.map((t) => ({ ...t, coach: true })), ...playerTeams.map((t) => ({ ...t, coach: false }))].filter((t, i, all) => all.findIndex((o) => o.id === t.id) === i);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ClubHeader title={data ? `Bonjour ${data.licencie.firstName}` : person ? `Bonjour ${person.firstName}` : "Accueil"} />
      {home.isPending ? <CardSkeletons count={3} /> : null}
      {home.error && !data ? <ErrorState title="Accueil indisponible" message={humanMessage(home.error)} onRetry={refresh} /> : null}

      {data ? (
        <>
          <AppText variant="callout" tone="muted">
            {coachTeams.length ? "Ton agenda de coach et tes prochains rendez-vous au club." : "Ton équipe, tes prochains matchs et tes rendez-vous au club."}
          </AppText>
          <View style={styles.badges}>
            {playerTeams.map((t) => (
              <Chip key={`p-${t.id}`} icon="shirt-outline" label={`Joue en ${t.name}`} onPress={() => router.push(`${base}/equipes/${t.id}`)} />
            ))}
            {coachTeams.map((t) => (
              <Chip key={`c-${t.id}`} icon="megaphone-outline" label={`Coach ${t.name}`} tone="info" onPress={() => router.push(`${base}/equipes/${t.id}`)} />
            ))}
            {data.roles.coordinator ? <Badge label="Coordinateur" /> : null}
            {data.roles.admin ? <Badge label="Admin" /> : null}
          </View>
          <View style={styles.actions}>
            {myTeams.map((t) => (
              <Button
                key={`team-${t.id}`}
                label={`${t.coach ? "Fiche équipe" : "Mon équipe"} ${t.name}`}
                icon={<Ionicons name="people" size={18} color={accent.ink} />}
                onPress={() => router.push(`${base}/equipes/${t.id}`)}
                fullWidth
              />
            ))}
            {data.roles.coach || data.roles.admin ? (
              <Button label="Entraînements" variant="secondary" icon={<Ionicons name="barbell-outline" size={18} color={colors.foreground} />} onPress={() => router.push(`${base}/entrainements`)} fullWidth />
            ) : null}
            {data.roles.coach ? (
              <Button label="Demander une dérogation" variant="secondary" icon={<Ionicons name="calendar-outline" size={18} color={colors.foreground} />} onPress={() => router.push(`${base}/derogations/nouvelle`)} fullWidth />
            ) : null}
            {data.roles.coach || data.roles.coordinator || data.roles.admin ? <Button label="Dérogations" variant="ghost" onPress={() => router.push(`${base}/derogations`)} /> : null}
          </View>
        </>
      ) : null}

      <PushInvite />

      {answerError ? <Banner tone="danger" message={answerError} /> : null}
      {center.data ? (
        <>
          <SectionHeader title={todo > 0 ? `À faire · ${todo}` : "À faire"} />
          {center.data.canAddRelative ? <Button label="Ajouter un enfant" variant="ghost" icon={<Ionicons name="person-add-outline" size={18} color={colors.foreground} />} onPress={() => setAddingPerson(true)} style={styles.start} /> : null}
          {actions.length === 0 ? <EmptyState title="Rien à faire pour l'instant" message="Les réponses attendues (entraînements, matchs, convocations) apparaîtront ici." /> : null}
          {actions.map((a) => (
            <ActionItem
              key={actionKey(a)}
              action={a}
              disabled={pending}
              answer={(x) => {
                clearError();
                answer(x);
              }}
            />
          ))}
        </>
      ) : null}

      {data && data.teams.length === 0 ? (
        <Banner tone="info" message={`Aucune équipe n'est encore associée à ton profil. Un responsable du club peut t'ajouter à ton équipe ${data.roles.coach ? "ou à celles que tu coaches " : ""}depuis la liste des joueurs.`} />
      ) : null}

      {data ? (
        <>
          <SectionHeader title="Mes tables de marque" />
          <TablesSummary home={data} tablesDone={tablesDone} onPress={() => router.push("/tables")} />

          <SectionHeader title="Derniers résultats" />
          {data.recentResults.length === 0 ? (
            <EmptyState icon="trophy-outline" title="Pas encore de résultat" message="Les scores de tes équipes apparaissent ici dès leur publication." />
          ) : (
            <DayGroups
              groups={groupByDay(data.recentResults, (e) => e.match.matchDatetime)}
              itemKey={(e) => e.match.id}
              render={({ match }) => <MatchCard match={match} club={club} onPress={() => router.push(`${base}/matchs/${match.id}`)} />}
            />
          )}

          <SectionHeader title="Mon agenda" />
          <Button label="Voir mon planning" size="lg" icon={<Ionicons name="calendar" size={20} color={accent.ink} />} onPress={() => router.push("/planning")} fullWidth />
          {agenda.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Rien de prévu"
              message={data.teams.length ? "Les prochains matchs (publiés par la FFBB) et les entraînements de tes équipes apparaîtront ici." : "Ton agenda s'affichera dès qu'une équipe sera associée à ton profil."}
            />
          ) : (
            <DayGroups
              groups={groupByDay(agenda, (item) => item.at, club.timezone)}
              itemKey={(item) => item.key}
              unit="rendez-vous"
              render={(item) => <AgendaEntry item={item} home={data} severalPeople={severalPeople} club={club} base={base} />}
            />
          )}
        </>
      ) : null}
      <Sheet visible={addingPerson} title="Ajouter un enfant" onClose={() => setAddingPerson(false)}>
        <AppText variant="callout" tone="muted">
          Un parent avec plusieurs enfants au club : retrouve le nom de l&apos;autre enfant et ouvre son lien sur ce téléphone. Les entraînements de chacun s&apos;afficheront ensemble ici.
        </AppText>
        <LicensedSearchCard clubSlug={club.slug} variant="bare" />
      </Sheet>
      {center.data?.invalidTokenIndexes.length ? (
        <AppText variant="meta" tone="subtle">
          Une personne de cet appareil n&apos;est plus accessible (lien renouvelé par le club).
        </AppText>
      ) : null}
    </Screen>
  );
}

function Chip({ icon, label, onPress, tone = "accent" }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; tone?: "accent" | "info" }) {
  const accent = useClubAccent();
  const fg = tone === "info" ? colors.info : accent.text;
  const bg = tone === "info" ? colors.infoSoft : accent.soft;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, page de l'équipe`} onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: bg }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={14} color={fg} />
      <AppText variant="meta" color={fg} style={styles.chipText}>
        {label} →
      </AppText>
    </Pressable>
  );
}

function TablesSummary({ home, tablesDone, onPress }: { home: PublicHomeDto; tablesDone: number | null; onPress: () => void }) {
  const accent = useClubAccent();
  const planned = home.tableDuties.length;
  return (
    <>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.tableCard, pressed && styles.pressed]}>
        <View style={[styles.tableIcon, { backgroundColor: accent.soft }]}>
          <Ionicons name="clipboard-outline" size={22} color={accent.text} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">
            {tablesDone === null ? "Tables de marque" : `${tablesDone} table${tablesDone > 1 ? "s" : ""} réalisée${tablesDone > 1 ? "s" : ""} cette saison`}
          </AppText>
          <AppText variant="meta" tone="muted">
            {planned ? `${planned} prévue${planned > 1 ? "s" : ""} · ` : ""}Touche pour te positionner sur un match.
          </AppText>
        </View>
        <Ionicons name="arrow-forward" size={20} color={accent.text} />
      </Pressable>
      {home.tableDuties.map((d) => (
        <Card key={`${d.matchId}-${d.role}`} style={styles.duty}>
          <View style={styles.dutyIcon}>
            <Ionicons name="clipboard" size={16} color={colors.success} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{TABLE_ROLES.find((r) => r.role === d.role)?.label ?? d.role}</AppText>
            <AppText variant="meta" tone="muted" numberOfLines={1}>
              {[d.matchDatetime ? `${formatShortDay(d.matchDatetime, MATCH_TZ)} · ${formatTime(d.matchDatetime, MATCH_TZ)}` : "Date à confirmer", d.teamName, d.opponentName ? `vs ${d.opponentName}` : null].filter(Boolean).join(" · ")}
            </AppText>
          </View>
        </Card>
      ))}
    </>
  );
}

function AgendaEntry({ item, home, severalPeople, club, base }: { item: AgendaItem; home: PublicHomeDto; severalPeople: boolean; club: ReturnType<typeof useClubInfo>; base: string }) {
  const relations = item.kind === "MATCH" ? item.entry.relations : item.relations;
  const forNames = item.kind === "EVENT" && severalPeople ? item.forFirstNames : [];
  const showBadges = home.teams.length > 1 || severalPeople || relations.includes("COACH");
  const badges: ReactNode = showBadges ? (
    <View style={styles.badges}>
      {relations.map((r) => (
        <Badge key={r} tone={r === "COACH" ? "info" : "neutral"} label={RELATION_LABEL[r]} />
      ))}
      {forNames.length ? <Badge label={forNames.join(", ")} /> : null}
    </View>
  ) : null;

  if (item.kind === "MATCH") {
    const { match } = item.entry;
    return (
      <View style={styles.entry}>
        {badges}
        <MatchCard match={match} club={club} onPress={() => router.push(`${base}/matchs/${match.id}`)} />
      </View>
    );
  }
  const e = item.event;
  const href = e.kind === "MATCH" ? `${base}/matchs/${e.id}` : `${base}/entrainements/${e.id}`;
  return (
    <View style={styles.entry}>
      {badges}
      <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={({ pressed }) => [styles.event, pressed && styles.pressed]}>
        <AppText variant="numeric" style={styles.eventTime}>
          {formatTime(e.startsAt, club.timezone)}
        </AppText>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {e.title}
          </AppText>
          {e.location ? (
            <AppText variant="meta" tone="muted" numberOfLines={1}>
              {e.location}
            </AppText>
          ) : null}
        </View>
        {e.status === "cancelled" ? <Badge tone="danger" label="Annulé" /> : e.status === "postponed" ? <Badge tone="warning" label="Reporté" /> : <Ionicons name={e.kind === "MATCH" ? "basketball-outline" : "fitness-outline"} size={20} color={colors.subtle} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: "flex-start" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actions: { gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill },
  chipText: { fontWeight: "600" },
  pressed: { opacity: 0.85 },
  flex: { flex: 1 },
  tableCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  tableIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  duty: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, padding: spacing.md },
  dutyIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: colors.successSoft },
  entry: { gap: spacing.sm },
  event: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  eventTime: { minWidth: 56, fontSize: 18 },
});
