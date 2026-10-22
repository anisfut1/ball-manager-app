import { Alert, Linking, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type IssueDto } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Button, Card, CardSkeletons, EmptyState, ErrorState, SectionHeader } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";

/** Libellés et sections : les mêmes que la page Anomalies du site. */
const TYPE_LABELS: Record<IssueDto["type"], string> = {
  venue_closure_conflict: "Match prévu dans un gymnase indisponible",
  venue_time_conflict: "Même salle, même créneau",
  team_double_booking: "Équipe programmée deux fois le même jour",
  fbi_schedule_mismatch: "Horaire ou salle différents entre FFBB et FBI",
  fbi_schedule_missing_in_ffbb: "Rencontre absente du calendrier FFBB",
  fbi_schedule_missing_in_fbi: "Rencontre absente de FBI",
  emarque_import_error: "Feuille de match illisible",
  emarque_needs_review: "Feuille de match à vérifier",
};

const SECTIONS: { title: string; description: string; integration: IssueDto["integration"] }[] = [
  { title: "Conflits de planning", description: "Deux matchs qui se gênent, ou un match prévu dans un gymnase indisponible.", integration: "scheduling" },
  { title: "Écarts FFBB / FBI", description: "FBI fait foi : vérifie l'horaire ou la salle sur FBI.", integration: "fbi_schedule" },
  { title: "Feuilles de match", description: "Feuille e-Marque à relire avant de publier les statistiques.", integration: "emarque" },
];

function when(iso: string | null, timeZone: string, withDay = true): string {
  if (!iso) return "Date inconnue";
  const label = new Date(iso).toLocaleString("fr-FR", { timeZone, ...(withDay ? { weekday: "long", day: "numeric", month: "long" } : {}), hour: "2-digit", minute: "2-digit" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Anomalies à traiter (admins) — comme sur le site, avec « Retirer ». */
export default function AdminIssuesScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const queryClient = useQueryClient();
  const issues = useQuery({ queryKey: queryKeys.adminIssues(slug), queryFn: () => adminApi.issues(slug) });
  const dismiss = useMutation({
    mutationFn: (key: string) => adminApi.dismissIssue(slug, key),
    onSuccess: (_, key) => queryClient.setQueryData<IssueDto[]>(queryKeys.adminIssues(slug), (list) => list?.filter((i) => i.key !== key)),
    onError: (error) => Alert.alert("Impossible de retirer l'anomalie", humanMessage(error)),
  });

  const confirmDismiss = (issue: IssueDto) =>
    Alert.alert("Retirer cette anomalie ?", "Elle reviendra seulement si la situation change (match déplacé, nouveau conflit).", [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => dismiss.mutate(issue.key) },
    ]);

  const visible = (issues.data ?? []).filter((i) => i.status !== "auto_corrected");

  return (
    <AdminScreen title="Anomalies" onRefresh={() => void issues.refetch()}>
      {() =>
        issues.isPending ? (
          <CardSkeletons count={3} />
        ) : issues.isError ? (
          <ErrorState message={humanMessage(issues.error)} onRetry={() => void issues.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="Aucune anomalie" message="Pas de conflit de planning ni de feuille de match à vérifier." />
        ) : (
          <>
            {SECTIONS.map((section) => {
              const list = visible.filter((i) => i.integration === section.integration);
              if (list.length === 0) return null;
              return (
                <View key={section.title} style={styles.section}>
                  <SectionHeader title={`${section.title} (${list.length})`} />
                  <AppText variant="meta" tone="muted">
                    {section.description}
                  </AppText>
                  {list.map((issue) => (
                    <IssueCard key={issue.key} issue={issue} timeZone={club.timezone} onOpenMatch={(id) => router.push(`/c/${slug}/matchs/${id}`)} onDismiss={() => confirmDismiss(issue)} />
                  ))}
                </View>
              );
            })}
          </>
        )
      }
    </AdminScreen>
  );
}

function IssueCard({ issue, timeZone, onOpenMatch, onDismiss }: { issue: IssueDto; timeZone: string; onOpenMatch: (matchId: string) => void; onDismiss: () => void }) {
  const isError = issue.severity === "error";
  return (
    <Card style={[styles.card, { borderLeftColor: isError ? colors.danger : colors.warning }]}>
      <View style={styles.head}>
        <AppText variant="eyebrow" tone="muted" style={styles.flex}>
          {TYPE_LABELS[issue.type]}
        </AppText>
        <Badge tone={isError ? "danger" : "warning"} label={isError ? "À corriger" : "À vérifier"} />
      </View>
      {issue.relatedMatches.length === 0 ? <AppText variant="headline">{`Match n°${issue.numero ?? "?"} — vs ${issue.opponentName ?? "?"}`}</AppText> : null}
      <AppText variant="meta" tone="muted">
        {when(issue.matchDatetime, timeZone)}
      </AppText>
      <AppText variant="callout">{issue.message}</AppText>

      {issue.relatedMatches.map((match) => (
        <View key={match.matchId} style={styles.match}>
          <AppText variant="bodyStrong">{`${match.teamName ?? "Équipe ?"} · ${when(match.matchDatetime, timeZone, false)}`}</AppText>
          <AppText variant="meta" tone="muted">{`n°${match.numero ?? "?"} — vs ${match.opponentName ?? "?"}`}</AppText>
          {match.venueLabel ? (
            <AppText variant="meta" tone="muted">
              {match.venueLabel}
            </AppText>
          ) : null}
          {match.coaches.length ? (
            match.coaches.map((coach) => (
              <View key={coach.name} style={styles.coach}>
                <Ionicons name="person-outline" size={14} color={colors.subtle} />
                <AppText variant="meta">{coach.name}</AppText>
                {coach.phone ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={`Appeler ${coach.name}`} onPress={() => void Linking.openURL(`tel:${coach.phone!.replace(/\s+/g, "")}`)} hitSlop={6}>
                    <AppText variant="meta" color={colors.info}>
                      {coach.phone}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
            ))
          ) : (
            <AppText variant="meta" tone="subtle">
              Aucun coach renseigné pour cette équipe.
            </AppText>
          )}
          <Button label="Ouvrir le match" variant="ghost" onPress={() => onOpenMatch(match.matchId)} />
        </View>
      ))}

      {issue.qualityWarnings.map((warning, index) => (
        <AppText key={`${warning.code}-${index}`} variant="meta" tone="muted">
          {`• ${warning.message}`}
        </AppText>
      ))}

      <View style={styles.actions}>
        {issue.matchId && issue.relatedMatches.length === 0 ? <Button label="Ouvrir le match" variant="secondary" onPress={() => onOpenMatch(issue.matchId!)} /> : null}
        <Button label="Retirer" variant="ghost" onPress={onDismiss} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  card: { borderLeftWidth: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  match: { gap: 2, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  coach: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
});
