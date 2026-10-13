import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { TeamOverviewDto } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Card, CardSkeletons, EmptyState, ErrorState, SegmentedControl } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { WeekPlanning } from "@/features/planning/WeekPlanning";
import { attendanceLabel, convocationSummary, locationLabel, relativeDay, shortDateTime, timeOf } from "@/features/team-life/web-labels";
import { useRoles } from "@/features/roles/useRoles";
import { useTeamOverview } from "./useTeamOverview";

export type TeamTab = "apercu" | "planning" | "effectif";

export function teamTabOf(value: string | undefined): TeamTab {
  return value === "planning" || value === "effectif" ? value : "apercu";
}

/**
 * Page Équipe — copie du TeamPageView du web : Vue d'ensemble / Planning /
 * Effectif. Réservée aux joueurs de l'équipe et à ceux qui la gèrent (le
 * serveur décide).
 */
export function TeamPage({ teamId, initialTab = "apercu" }: { teamId: string; initialTab?: TeamTab }) {
  const [tab, setTab] = useState<TeamTab>(initialTab);
  const overview = useTeamOverview(teamId);
  const { loading: rolesLoading } = useRoles();

  if (overview.isPending && (overview.fetchStatus !== "idle" || rolesLoading)) return <CardSkeletons count={3} />;
  if (overview.error) return <ErrorState title="Équipe indisponible" message={humanMessage(overview.error)} onRetry={() => void overview.refetch()} />;
  if (!overview.data) return <EmptyState icon="lock-closed-outline" title="Réservé à l'équipe" message="Les joueurs de l'équipe, leurs parents et les coachs voient cette page." />;
  const team = overview.data.data;
  const coaches = team.roster.filter((r) => r.isCoach);
  const players = team.roster.filter((r) => !r.isCoach);

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <AppText variant="eyebrow" tone="subtle">
          Équipe
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {team.team.name}
        </AppText>
        <AppText variant="meta" tone="muted">
          {`${players.length} joueur${players.length > 1 ? "s" : ""}${coaches.length ? ` · ${coaches.length} coach${coaches.length > 1 ? "s" : ""}` : ""}`}
        </AppText>
      </View>
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "apercu", label: "Vue d'ensemble" },
          { value: "planning", label: "Planning" },
          { value: "effectif", label: "Effectif" },
        ]}
      />
      {tab === "planning" ? <WeekPlanning teamId={teamId} /> : tab === "effectif" ? <RosterTab team={team} /> : <OverviewTab team={team} teamId={teamId} onRoster={() => setTab("effectif")} />}
    </View>
  );
}

function CardTitle({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.cardTitle}>
      <Ionicons name={icon} size={14} color={colors.subtle} />
      <AppText variant="eyebrow" tone="subtle">
        {label}
      </AppText>
    </View>
  );
}

function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  const accent = useClubAccent();
  return (
    <AppText variant="bodyStrong" color={accent.text} accessibilityRole="link" onPress={onPress} style={styles.link}>
      {`${label} →`}
    </AppText>
  );
}

function OverviewTab({ team, teamId, onRoster }: { team: TeamOverviewDto; teamId: string; onRoster: () => void }) {
  const club = useActiveClub();
  const tz = club.timezone;
  const m = team.nextMatch;
  const t = team.nextTraining;
  const coaches = team.roster.filter((r) => r.isCoach);
  const relative = t ? relativeDay(t.startsAt, tz) : "";
  return (
    <View style={styles.page}>
      <Card style={styles.card}>
        <CardTitle icon="trophy-outline" label="Prochain match" />
        {m ? (
          <>
            <View style={styles.lines}>
              <AppText variant="headline">{m.opponent ? `${m.isHome === false ? "À" : "Contre"} ${m.opponent}` : "Adversaire à confirmer"}</AppText>
              <AppText variant="meta" tone="muted">
                {shortDateTime(m.startsAt, tz)}
              </AppText>
              <View style={styles.badges}>
                {m.isHome === null ? null : <Badge tone={m.isHome ? "info" : "neutral"} label={m.isHome ? "Domicile" : "Extérieur"} />}
                {m.venueName ? (
                  <View style={styles.inline}>
                    <Ionicons name="location-outline" size={14} color={colors.muted} />
                    <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.flex}>
                      {m.venueName}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </View>
            {m.convocation ? (
              <View style={styles.note}>
                <AppText variant="callout">
                  {m.convocation.sent
                    ? `Convocation envoyée : ${convocationSummary(m.convocation)}`
                    : m.availability?.open
                      ? `Disponibilités demandées${m.availability.noResponse ? ` · ${m.availability.noResponse} sans réponse` : " · tout le monde a répondu"} — convocation à préparer`
                      : "Disponibilités pas encore demandées"}
                </AppText>
              </View>
            ) : null}
            <LinkText label={team.canManage ? "Gérer le match" : "Voir le match"} onPress={() => router.push(`/c/${club.clubSlug}/matchs/${m.id}${team.canManage ? "?section=coach" : ""}`)} />
          </>
        ) : (
          <AppText variant="meta" tone="muted">
            Aucun match programmé.
          </AppText>
        )}
      </Card>

      <Card style={styles.card}>
        <CardTitle icon="barbell-outline" label="Prochain entraînement" />
        {t ? (
          <>
            <View style={styles.lines}>
              <AppText variant="headline">{relative.charAt(0).toUpperCase() + relative.slice(1)}</AppText>
              <AppText variant="meta" tone="muted">{`${timeOf(t.startsAt, tz)}–${timeOf(t.endsAt, tz)}`}</AppText>
              {locationLabel(t.location) ? (
                <View style={styles.inline}>
                  <Ionicons name="location-outline" size={14} color={colors.muted} />
                  <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.flex}>
                    {locationLabel(t.location)}
                  </AppText>
                </View>
              ) : null}
            </View>
            {t.counts ? (
              <View style={styles.note}>
                <AppText variant="callout">
                  {`${t.counts.present} présent${t.counts.present > 1 ? "s" : ""} · ${t.counts.absent} absent${t.counts.absent > 1 ? "s" : ""}${t.counts.uncertain ? ` · ${t.counts.uncertain} incertain${t.counts.uncertain > 1 ? "s" : ""}` : ""}${t.counts.noResponse ? ` · ${t.counts.noResponse} sans réponse` : ""}`}
                </AppText>
              </View>
            ) : null}
            <LinkText label="Voir la séance" onPress={() => router.push(`/c/${club.clubSlug}/entrainements/${t.id}`)} />
          </>
        ) : (
          <AppText variant="meta" tone="muted">
            Aucun entraînement prévu dans les 30 prochains jours.
          </AppText>
        )}
        {team.canManage ? <LinkText label="Gérer les entraînements" onPress={() => router.push(`/c/${club.clubSlug}/entrainements?equipe=${teamId}`)} /> : null}
      </Card>

      <Card style={styles.card}>
        <CardTitle icon="megaphone-outline" label="Encadrement" />
        {coaches.length ? (
          <View style={styles.coaches}>
            {coaches.map((c) => (
              <View key={c.licencie.id} style={styles.inline}>
                <Avatar firstName={c.licencie.firstName} lastName={c.licencie.lastName} photoUrl={c.licencie.photoUrl} />
                <AppText variant="bodyStrong">{`${c.licencie.firstName} ${c.licencie.lastName}`}</AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText variant="meta" tone="muted">
            Aucun coach rattaché à cette équipe (liste des joueurs).
          </AppText>
        )}
        <LinkText label="Voir l'effectif" onPress={onRoster} />
      </Card>
    </View>
  );
}

function RosterTab({ team }: { team: TeamOverviewDto }) {
  if (!team.roster.length) return <EmptyState icon="people-outline" title="Effectif vide" message="Aucun licencié actif n'est rattaché à cette équipe (liste des joueurs)." />;
  const linked = team.canManage ? team.roster.filter((r) => r.hasPersonalLink).length : null;
  // Assiduité (coach / admin) : séances où le coach a relevé la présence, les plus récentes.
  const sessions = team.roster.find((r) => r.attendance)?.attendance?.sessions ?? null;
  return (
    <View style={styles.page}>
      {linked !== null ? (
        <AppText variant="meta" tone="muted">
          {`${linked} / ${team.roster.length} avec un lien personnel actif`}
        </AppText>
      ) : null}
      {sessions !== null ? (
        <AppText variant="meta" tone="muted">
          {sessions === 0 ? "Assiduité : aucune séance relevée pour l'instant (page Entraînements → Dernières séances)." : `Assiduité sur ${sessions === 1 ? "la dernière séance relevée" : `les ${sessions} dernières séances relevées`}.`}
        </AppText>
      ) : null}
      <Card padded={false}>
        {team.roster.map((r, i) => (
          <View key={r.licencie.id} style={[styles.row, i > 0 && styles.divider]}>
            <Avatar firstName={r.licencie.firstName} lastName={r.licencie.lastName} photoUrl={r.licencie.photoUrl} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>{`${r.licencie.firstName} ${r.licencie.lastName}`}</AppText>
              {r.attendance && r.attendance.sessions > 0 && !r.isCoach ? (
                <AppText variant="meta" tone={r.attendance.absent >= 3 ? "danger" : "muted"}>
                  {attendanceLabel(r.attendance)}
                </AppText>
              ) : null}
            </View>
            {r.isCoach ? <Badge tone="info" label="Coach" /> : null}
            {r.hasPersonalLink === null ? null : r.hasPersonalLink ? <Badge tone="success" label="Lien actif" /> : <Badge label="Sans lien" />}
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  head: { gap: 2 },
  card: { gap: spacing.md },
  cardTitle: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  lines: { gap: 4 },
  badges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexShrink: 1 },
  flex: { flex: 1, flexShrink: 1 },
  note: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  link: { alignSelf: "flex-start" },
  coaches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
