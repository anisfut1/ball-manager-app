import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MatchDetailsDto } from "@/api/endpoints/teamLife";
import type { Dto } from "@/api/types";
import { AppText, Badge, Banner, Card, EmptyState } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { DOCUMENT_TYPE_LABELS, EMARQUE_STATUS, MATCH_STATUS_LABELS, REFEREE_ROLE_LABELS, TABLE_OFFICIAL_ROLE_LABELS, personName } from "./labels";
import { PlayerStatCards } from "./PlayerStatCards";
import type { ScoreboardTeam } from "./Scoreboard";

type MatchDocument = Dto<"MatchDocumentDto">;

/** Panneaux de la fiche match, mêmes contenus que le web (src/features/matches/detail/Panels.tsx), en lecture seule. */

function Header({ icon, title, right }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.header}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <AppText variant="headline" style={styles.flex}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

function DataRow({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View style={[styles.data, !first && styles.sep]}>
      <AppText variant="meta" tone="muted">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

export function InformationsPanel({ match, home, away }: { match: MatchDetailsDto; home: ScoreboardTeam; away: ScoreboardTeam }) {
  const rows = [
    ["Rencontre", `N° ${match.numero ?? "?"}`],
    ["Journée", match.journee ?? "—"],
    ["Lieu", match.venueLabel ?? "À confirmer"],
    ["Score", match.scoreHome !== null && match.scoreAway !== null ? `${home.name} ${match.scoreHome} - ${match.scoreAway} ${away.name}` : "Non disponible"],
    ["Statut", MATCH_STATUS_LABELS[match.status] ?? match.status],
  ];
  return (
    <Card>
      <Header icon="information-circle-outline" title="Informations" />
      <View>
        {rows.map(([label, value], i) => (
          <DataRow key={label} label={label} value={value} first={i === 0} />
        ))}
      </View>
    </Card>
  );
}

function TeamHeader({ team, side }: { team: ScoreboardTeam; side: "home" | "away" }) {
  return (
    <View style={styles.header}>
      <ClubBadge name={team.logoName} logoUrl={team.logoUrl} accentColor={team.isClub ? team.accentColor : "#807E76"} size={36} />
      <View style={styles.flex}>
        <AppText variant="headline">{team.name}</AppText>
        <AppText variant="meta" tone="muted">
          {side === "home" ? "Domicile" : "Extérieur"}
        </AppText>
      </View>
    </View>
  );
}

export function CompositionPanel({ match, home, away }: { match: MatchDetailsDto; home: ScoreboardTeam; away: ScoreboardTeam }) {
  const { participants, coaches } = match;
  if (participants.length === 0 && coaches.length === 0) return <EmptyState icon="people-outline" title="Composition pas encore disponible" message="Document e-Marque non importé pour ce match." />;
  return (
    <>
      {(["home", "away"] as const).map((side) => (
        <Card key={side}>
          <TeamHeader team={side === "home" ? home : away} side={side} />
          <View>
            {participants
              .filter((p) => p.teamSide === side)
              .map((p, i) => (
                <View key={p.id} style={[styles.player, i > 0 && styles.sep]}>
                  <View style={styles.jersey}>
                    <AppText variant="bodyStrong">{p.jerseyNumber ?? "?"}</AppText>
                  </View>
                  <AppText variant="body" style={styles.flex}>
                    {personName(p)}
                  </AppText>
                  {p.isCaptain ? <Badge tone="info" label="C" /> : null}
                  {p.isStarter ? <Badge label="Titulaire" /> : null}
                </View>
              ))}
          </View>
          {coaches
            .filter((c) => c.teamSide === side)
            .map((c, i) => (
              <View key={`coach-${i}`} style={styles.coach}>
                <Ionicons name="person-outline" size={15} color={colors.subtle} />
                <AppText variant="callout" tone="muted">
                  {c.role === "principal" ? "Entraîneur" : "Entraîneur adjoint"} : <AppText variant="callout">{personName(c)}</AppText>
                </AppText>
              </View>
            ))}
        </Card>
      ))}
    </>
  );
}

export function StatsPanel({ match, home, away, playerBase }: { match: MatchDetailsDto; home: ScoreboardTeam; away: ScoreboardTeam; playerBase: string | null }) {
  const { stats } = match;
  if (stats.length === 0) {
    if (match.emarque.status === "needs_review" || match.emarque.status === "error") return <EmptyState icon="clipboard-outline" title="Statistiques en cours de vérification" message="La feuille e-Marque a été lue mais n'a pas passé les contrôles de cohérence : elles seront publiées une fois vérifiées." />;
    if (match.emarque.status === "not_available") return <EmptyState icon="clipboard-outline" title="Pas de feuille e-Marque" message="Aucune feuille e-Marque n'a été publiée sur FBI pour ce match." />;
    return <EmptyState icon="clipboard-outline" title="Statistiques pas encore disponibles" message="Elles apparaîtront automatiquement dès que la feuille e-Marque du match sera publiée sur FBI et lue." />;
  }
  return (
    <>
      {(["home", "away"] as const).map((side) => {
        const team = side === "home" ? home : away;
        return (
          <View key={side} style={styles.statBlock}>
            <View style={styles.header}>
              <ClubBadge name={team.logoName} logoUrl={team.logoUrl} accentColor={team.isClub ? team.accentColor : "#807E76"} size={28} />
              <AppText variant="headline" style={styles.flex}>
                {team.name}
              </AppText>
            </View>
            <PlayerStatCards rows={stats.filter((r) => r.teamSide === side)} accent={team.isClub} playerBase={playerBase} />
          </View>
        );
      })}
      <AppText variant="meta" tone="subtle">
        « — » signifie une donnée non lue avec certitude sur le document, jamais une valeur nulle supposée.
      </AppText>
    </>
  );
}

export function OfficialsPanel({ match }: { match: MatchDetailsDto }) {
  const { officials, tableOfficials } = match;
  if (officials.length === 0 && tableOfficials.length === 0) return <EmptyState icon="flag-outline" title="Officiels pas encore disponibles" message="Ils sont lus sur la feuille e-Marque une fois celle-ci importée." />;
  const lists: { title: string; icon: keyof typeof Ionicons.glyphMap; rows: { role: string; name: string }[] }[] = [
    { title: "Arbitres", icon: "scale-outline", rows: officials.map((o) => ({ role: REFEREE_ROLE_LABELS[o.role] ?? o.role, name: personName(o) })) },
    { title: "Officiels de table (OTM)", icon: "clipboard-outline", rows: tableOfficials.map((o) => ({ role: TABLE_OFFICIAL_ROLE_LABELS[o.role] ?? o.role, name: personName(o) })) },
  ];
  return (
    <>
      {lists.map((list) => (
        <Card key={list.title}>
          <Header icon={list.icon} title={list.title} />
          {list.rows.length === 0 ? (
            <AppText variant="meta" tone="muted">
              Non disponible
            </AppText>
          ) : (
            list.rows.map((row, i) => <DataRow key={i} label={row.role} value={row.name} first={i === 0} />)
          )}
        </Card>
      ))}
    </>
  );
}

export function EmarquePanel({ match, documents }: { match: MatchDetailsDto; documents: MatchDocument[] }) {
  const status = EMARQUE_STATUS[match.emarque.status] ?? { label: match.emarque.status, tone: "neutral" as const };
  const warnings = match.emarque.qualityWarningCount;
  return (
    <Card>
      <Header icon="document-text-outline" title="e-Marque" right={<Badge tone={status.tone} label={status.label} />} />
      <AppText variant="meta" tone="muted">
        Feuille de match numérique récupérée depuis FBI.
      </AppText>
      <View>
        <DataRow first label="Statut" value={status.label} />
        <DataRow label="Source" value={match.emarque.source ?? "—"} />
        <DataRow label="Dernière récupération" value={match.emarque.lastRetrievedAt ? new Date(match.emarque.lastRetrievedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "—"} />
      </View>
      {warnings !== null && warnings > 0 ? <Banner tone="warning" message="Certaines informations de ce match sont en cours de vérification par un administrateur." /> : null}
      <AppText variant="eyebrow" tone="subtle">
        Documents
      </AppText>
      {documents.length ? (
        <>
          {documents.map((doc) => (
            <View key={doc.id} style={styles.doc}>
              <Ionicons name="document-outline" size={18} color={colors.muted} />
              <AppText variant="bodyStrong" style={styles.flex}>
                {DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}
              </AppText>
            </View>
          ))}
          <AppText variant="meta" tone="muted">
            Le document original n&apos;est téléchargeable que depuis l&apos;espace du club (compte administrateur).
          </AppText>
        </>
      ) : (
        <AppText variant="meta" tone="muted" style={styles.none}>
          Aucun document e-Marque récupéré pour l&apos;instant — ce n&apos;est pas une erreur, la récupération automatique réessaiera régulièrement une fois le match terminé.
        </AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  data: { paddingVertical: spacing.sm, gap: 2 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  player: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44, paddingVertical: spacing.xs },
  jersey: { minWidth: 34, height: 32, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xs },
  coach: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  statBlock: { gap: spacing.md },
  doc: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  none: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong },
});
