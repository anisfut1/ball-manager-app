import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { TABLE_ROLES, tablesApi, type TableMatch, type TableRole } from "@/api/endpoints/tables";
import { useActiveClub, useSession } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, Screen } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubHeader } from "@/features/home/ClubHeader";
import { MATCH_TZ, matchTime } from "@/features/matches/match-model";
import { useRoles } from "@/features/roles/useRoles";
import { TableSuggestionsSheet } from "@/features/tables/TableSuggestionsSheet";
import { formatShortDay } from "@/lib/dates";
import { addDays, currentOrNextWeekendSaturday, formatWeekendLabel, weekendRange } from "@/lib/weekend";

/** Route profonde (liens, notifications) : même écran que l'onglet « Tables ». */
export default function TablesScreen() {
  return <TablesView />;
}

/**
 * Tables de marque, comme la page Tables du web (BoardView) : une journée =
 * un week-end, navigation semaine par semaine. Chacun se positionne sur un
 * poste libre et se retire du sien ; un coach / responsable désigne aussi
 * quelqu'un d'autre (suggestions) et retire n'importe qui. `tab` : onglet.
 */
export function TablesView({ tab = false }: { tab?: boolean }) {
  const club = useActiveClub();
  const { person } = useSession();
  const { roles } = useRoles();
  const accent = useClubAccent();
  const queryClient = useQueryClient();
  const me = person?.licencieId ?? "";
  const manager = roles.actorFor("tables");
  const defaultSaturday = currentOrNextWeekendSaturday(club.timezone);
  const [saturday, setSaturday] = useState(defaultSaturday);
  const range = weekendRange(saturday, club.timezone);
  const key = [...queryKeys.tables(club.clubSlug), saturday] as const;
  const list = useQuery({ queryKey: key, queryFn: () => tablesApi.list(club.clubSlug, me, range.from, range.to), enabled: !!me });
  const [sheet, setSheet] = useState<{ matchId: string; role: TableRole; label: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const refresh = (message: string) => {
    setToast(message);
    void queryClient.invalidateQueries({ queryKey: queryKeys.tables(club.clubSlug) });
  };

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      {tab ? <ClubHeader title="Tables de marque" /> : <Stack.Screen options={{ headerShown: true, title: "Tables de marque", headerBackTitle: "Retour" }} />}
      <AppText variant="callout" tone="muted">
        {person ? `Bonjour ${person.firstName} — ` : ""}
        {manager ? "en tant que coach / responsable, tu peux désigner, remplacer ou retirer n'importe qui (toi compris) sur les matchs à domicile." : "positionne-toi sur un poste libre des matchs à domicile."}
      </AppText>

      <Button label="Classement des tables" variant="secondary" icon={<Ionicons name="trophy-outline" size={18} color={colors.foreground} />} onPress={() => router.push(`/c/${club.clubSlug}/tables/classement`)} fullWidth />
      <View style={styles.nav}>
        <NavButton icon="chevron-back" label="Journée précédente" onPress={() => setSaturday((s) => addDays(s, -7))} />
        <AppText variant="headline" style={styles.navLabel} accessibilityLiveRegion="polite">
          {formatWeekendLabel(saturday)}
        </AppText>
        <NavButton icon="chevron-forward" label="Journée suivante" onPress={() => setSaturday((s) => addDays(s, 7))} />
      </View>
      {saturday !== defaultSaturday ? <Button label="Revenir à ce week-end" variant="ghost" icon={<Ionicons name="today-outline" size={18} color={accent.text} />} onPress={() => setSaturday(defaultSaturday)} /> : null}

      {toast ? <Banner tone="success" message={toast} /> : null}
      {list.isPending ? <CardSkeletons count={2} /> : null}
      {list.error ? <ErrorState title="Chargement impossible" message={humanMessage(list.error)} onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.matches.length === 0 ? <EmptyState icon="clipboard-outline" title="Aucun match à domicile cette journée" message="Passe à la journée suivante pour voir les prochains matchs." /> : null}
      {list.data?.matches.map((m) => (
        <TableMatchCard key={m.match.id} match={m} meId={list.data.me.id} canManage={!!manager} onChanged={refresh} onDesignate={(role, label) => setSheet({ matchId: m.match.id, role, label })} />
      ))}
      {sheet && manager ? <TableSuggestionsSheet visible onClose={() => setSheet(null)} matchId={sheet.matchId} role={sheet.role} roleLabel={sheet.label} as={manager} /> : null}
    </Screen>
  );
}

function NavButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

function TableMatchCard({ match, meId, canManage, onChanged, onDesignate }: { match: TableMatch; meId: string; canManage: boolean; onChanged: (message: string) => void; onDesignate: (role: TableRole, label: string) => void }) {
  const club = useActiveClub();
  const { roles } = useRoles();
  const accent = useClubAccent();
  const manager = roles.actorFor("tables");
  const [error, setError] = useState<{ role: TableRole; message: string; canForce: boolean } | null>(null);
  const assign = useMutation({
    mutationFn: (v: { role: TableRole; force: boolean }) => tablesApi.assign(club.clubSlug, meId, match.match.id, v.role, undefined, v.force),
    onSuccess: (_, v) => onChanged(`Tu es positionné·e comme ${(TABLE_ROLES.find((r) => r.role === v.role)?.label ?? "").toLowerCase()}.`),
    onError: (e, v) => setError({ role: v.role, message: humanMessage(e), canForce: e instanceof ApiError && e.code === "MATCH_CONFLICT" }),
  });
  const remove = useMutation({
    mutationFn: (v: { role: TableRole; asManager: boolean }) => tablesApi.remove(club.clubSlug, v.asManager && manager ? manager : meId, match.match.id, v.role),
    onSuccess: (_, v) => onChanged(v.asManager ? "Poste libéré." : "Tu as été retiré·e de ce poste."),
    onError: (e, v) => setError({ role: v.role, message: humanMessage(e), canForce: false }),
  });
  const confirmRemove = (role: TableRole, label: string, mine: boolean, who: string) =>
    Alert.alert(mine ? "Te retirer de ce poste ?" : `Retirer ${who} ?`, `${label}`, [
      { text: "Annuler", style: "cancel" },
      { text: mine ? "Me retirer" : "Retirer", style: "destructive", onPress: () => remove.mutate({ role, asManager: !mine }) },
    ]);
  const time = matchTime(match.match);

  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.timeBox}>
          <AppText variant="eyebrow" tone="subtle">
            {match.match.matchDatetime ? formatShortDay(match.match.matchDatetime, MATCH_TZ).split(" ")[0] : "—"}
          </AppText>
          <AppText variant="numeric">{time ?? "--:--"}</AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="headline">
            {match.match.teamName ?? "Équipe"} <AppText variant="headline" tone="muted">vs</AppText> {match.match.opponentName ?? "?"}
          </AppText>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.subtle} />
            <AppText variant="meta" tone="muted" numberOfLines={1} style={styles.flex}>
              {match.match.venueLabel ?? "Lieu à confirmer"}
            </AppText>
          </View>
        </View>
      </View>
      {TABLE_ROLES.map(({ role, key, label }) => {
        const slot = match.assignments[key];
        const isMe = slot?.licencie.id === meId;
        const refereeSkipped = role === "REFEREE" && match.refereeNotNeeded;
        const busy = (assign.isPending && assign.variables?.role === role) || (remove.isPending && remove.variables?.role === role);
        const who = slot ? `${slot.licencie.firstName} ${slot.licencie.lastName}` : "";
        return (
          <View key={role} style={[styles.post, slot?.hasConflict ? styles.postConflict : isMe ? { borderColor: accent.accent, backgroundColor: accent.soft } : slot ? null : styles.postFree]}>
            <View style={styles.postHead}>
              <AppText variant="eyebrow" tone="subtle">
                {label}
              </AppText>
              {slot?.hasConflict ? <Badge tone="danger" label="Conflit détecté" /> : null}
            </View>
            {refereeSkipped && !slot ? (
              <View style={styles.metaRow}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.success} />
                <AppText variant="meta" tone="muted" style={styles.flex}>
                  Arbitre officiel FFBB déjà désigné — aucune affectation nécessaire.
                </AppText>
              </View>
            ) : slot ? (
              <View style={styles.postBody}>
                <Avatar firstName={slot.licencie.firstName} lastName={slot.licencie.lastName} photoUrl={slot.licencie.photoUrl} size={32} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {who}
                    {isMe ? <AppText variant="bodyStrong" color={accent.text}> (toi)</AppText> : null}
                  </AppText>
                  {slot.hasConflict && slot.conflictReason ? (
                    <AppText variant="meta" tone="danger">
                      {slot.conflictReason}
                    </AppText>
                  ) : null}
                </View>
                {isMe || canManage ? <Button label={isMe ? "Se retirer" : "Retirer"} variant="secondary" loading={busy} onPress={() => confirmRemove(role, label, isMe, who)} /> : null}
              </View>
            ) : (
              <View style={styles.postBody}>
                <Ionicons name="person-outline" size={16} color={colors.subtle} />
                <AppText variant="callout" tone="muted" style={styles.flex}>
                  À attribuer
                </AppText>
                {canManage ? <Button label="Désigner" variant="secondary" onPress={() => onDesignate(role, label)} /> : null}
                <Button label="Se positionner" loading={busy} icon={<Ionicons name="hand-left-outline" size={16} color={accent.ink} />} onPress={() => assign.mutate({ role, force: false })} />
              </View>
            )}
            {error?.role === role ? (
              error.canForce ? (
                <View style={styles.force}>
                  <AppText variant="meta" color={colors.warning}>
                    {error.message} — ton équipe joue sur ce créneau. Si tu ne joues pas ce match, tu peux quand même faire la table.
                  </AppText>
                  <Button label="Me positionner quand même" variant="secondary" loading={busy} onPress={() => assign.mutate({ role, force: true })} />
                </View>
              ) : (
                <AppText variant="meta" tone="danger">
                  {error.message}
                </AppText>
              )
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navLabel: { flex: 1, textAlign: "center" },
  navButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  pressed: { opacity: 0.8 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  timeBox: { width: 64, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  flex: { flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.xs },
  post: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  postFree: { borderStyle: "dashed", borderColor: colors.borderStrong, backgroundColor: colors.surface },
  postConflict: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  postHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  postBody: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  force: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.warningSoft },
});
