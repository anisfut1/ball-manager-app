import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { derogationsApi } from "@/api/endpoints/derogations";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Button, Card } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { useRoles } from "@/features/roles/useRoles";
import { formatDayLongCapitalized, formatRelative, formatTime, isActive } from "./labels";
import { OfficialDerogationForm } from "./Official";
import { RequestStatusBadge } from "./parts";

function Header({ icon, title, description, trailing }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; trailing?: React.ReactNode }) {
  const accent = useClubAccent();
  return (
    <View style={styles.header}>
      <View style={[styles.icon, { backgroundColor: accent.soft }]}>
        <Ionicons name={icon} size={18} color={accent.text} />
      </View>
      <View style={styles.flex}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="meta" tone="muted">
          {description}
        </AppText>
      </View>
      {trailing}
    </View>
  );
}

/**
 * Fiche match — bloc « Demande de dérogation » (demande INTERNE coach →
 * coordinateur), copie du web : visible seulement pour un coach /
 * coordinateur, et seulement s'il y a une demande ou le droit d'en créer.
 */
export function MatchRequestBlock({ matchId }: { matchId: string }) {
  const club = useActiveClub();
  const { roles } = useRoles();
  const as = roles.actorFor("derogations-create") ?? (roles.canManageDerogations ? roles.actorFor("derogations") : null);
  const context = useQuery({ queryKey: queryKeys.derogationContext(club.clubSlug), queryFn: () => derogationsApi.context(club.clubSlug, as!), enabled: !!as });
  const list = useQuery({ queryKey: queryKeys.matchDerogations(club.clubSlug, matchId), queryFn: () => derogationsApi.list(club.clubSlug, as!, matchId), enabled: !!as });
  // Bloc secondaire : une erreur ici ne doit jamais gêner la lecture du match.
  if (!as || !context.data || !list.data) return null;
  const tz = context.data.timezone;
  const requests = list.data.requests;
  const canCreate = context.data.canCreate && context.data.eligibleMatches.some((m) => m.id === matchId);
  const current = requests.find((r) => isActive(r.status)) ?? requests[0] ?? null;
  if (!current && !canCreate) return null;
  const base = `/c/${club.clubSlug}/derogations`;
  const newHref = `${base}/nouvelle?match=${matchId}`;

  if (!current) {
    return (
      <Card style={styles.gap}>
        <Header icon="calendar-outline" title="Demande de dérogation" description="Besoin de déplacer ce match ? Choisis une date et un créneau libre : le coordinateur du club reçoit ta demande." />
        <Button label="Demander une dérogation" onPress={() => router.push(newHref)} style={styles.start} />
      </Card>
    );
  }
  return (
    <Card style={styles.gap}>
      <Header icon="calendar-outline" title="Demande de dérogation" description="Demande interne au club — le calendrier officiel n'est pas modifié automatiquement." trailing={<RequestStatusBadge status={current.status} />} />
      <View style={styles.box}>
        <AppText variant="eyebrow" tone="subtle">
          Créneau demandé
        </AppText>
        <AppText variant="bodyStrong">{`${formatDayLongCapitalized(current.requestedStartAt, tz)} · ${formatTime(current.requestedStartAt, tz)} → ${formatTime(current.requestedEndAt, tz)}`}</AppText>
        <AppText variant="meta" tone="muted">
          {current.requestedVenue?.name ?? "À l'extérieur — à confirmer avec le club adverse"}
        </AppText>
        <AppText variant="meta" tone="muted">{`Demande formulée par : ${current.requesterDisplayName}`}</AppText>
      </View>
      {current.lastMessage ? (
        <View style={styles.inline}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.subtle} />
          <AppText variant="meta" tone="muted" style={styles.flex}>
            {`${current.lastMessage.type === "USER" ? `${current.lastMessage.authorDisplayName} : ` : ""}${current.lastMessage.excerpt}`}
          </AppText>
          <AppText variant="meta" tone="subtle">
            {formatRelative(current.lastMessageAt, new Date(), tz)}
          </AppText>
        </View>
      ) : null}
      <View style={styles.row}>
        <Button label="Voir la conversation" variant="secondary" onPress={() => router.push(`${base}/${current.id}`)} />
        {!isActive(current.status) && canCreate ? <Button label="Nouvelle demande" variant="ghost" onPress={() => router.push(newHref)} /> : null}
      </View>
    </Card>
  );
}

/**
 * Fiche match — « Créer une dérogation » officielle FBI pour l'admin du club
 * ou le coordinateur (comme le web). Écrit réellement sur FBI.
 */
export function MatchOfficialBlock({ matchId }: { matchId: string }) {
  const club = useActiveClub();
  const { roles } = useRoles();
  const queryClient = useQueryClient();
  const as = roles.actorFor("official");
  if (!as) return null;
  return (
    <Card style={styles.gap}>
      <Header icon="document-text-outline" title="Dérogation officielle (FBI)" description="Envoie directement la demande de dérogation sur FBI pour ce match, comme depuis l'espace club." />
      <OfficialDerogationForm submit={(body) => derogationsApi.createOfficial(club.clubSlug, as, matchId, body)} onSuccess={() => void queryClient.invalidateQueries({ queryKey: queryKeys.officialDerogations(club.clubSlug) })} />
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  start: { alignSelf: "flex-start" },
  flex: { flex: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  inline: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  box: { gap: 4, padding: spacing.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
});
