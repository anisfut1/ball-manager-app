import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { TABLE_ROLES, tablesApi, type TableRole } from "@/api/endpoints/tables";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, ListRow, Screen } from "@/components/ui";
import { spacing } from "@/design";
import { useRoles } from "@/features/roles/useRoles";
import { TableSuggestionsSheet } from "@/features/tables/TableSuggestionsSheet";
import { addDaysKey, dayKey, relativeDayTime } from "@/lib/dates";

/** Tables de marque des matchs à domicile : postes, suggestions, conflits, affectation manuelle. */
export default function TablesScreen() {
  const club = useActiveClub();
  const { roles } = useRoles();
  const queryClient = useQueryClient();
  const manager = roles.actorFor("tables");
  const as = manager ?? club.people[0]?.licencieId ?? "";
  const today = dayKey(new Date(), club.timezone);
  const list = useQuery({ queryKey: queryKeys.tables(club.clubSlug), queryFn: () => tablesApi.list(club.clubSlug, as, today, addDaysKey(today, 41)), enabled: !!as });
  const [open, setOpen] = useState<{ matchId: string; role: TableRole; label: string } | null>(null);
  const remove = useMutation({ mutationFn: (v: { matchId: string; role: TableRole }) => tablesApi.remove(club.clubSlug, as, v.matchId, v.role), onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.tables(club.clubSlug) }) });

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <Stack.Screen options={{ headerShown: true, title: "Tables de marque", headerBackTitle: "Retour" }} />
      {!manager ? <Banner tone="info" message="Lecture seule : seuls les responsables des tables affectent les postes." /> : null}
      {remove.error ? <Banner tone="danger" message={humanMessage(remove.error)} /> : null}
      {list.isPending ? <CardSkeletons count={2} /> : null}
      {list.error ? <ErrorState message={humanMessage(list.error)} onRetry={() => void list.refetch()} /> : null}
      {list.data && list.data.matches.length === 0 ? <EmptyState icon="clipboard-outline" title="Aucun match à domicile" message="Rien à organiser sur les six prochaines semaines." /> : null}
      {list.data?.matches.map((m) => {
        const roles = TABLE_ROLES.filter((r) => r.role !== "REFEREE" || !m.refereeNotNeeded);
        const filled = roles.filter((r) => m.assignments[r.key]).length;
        return (
          <Card key={m.match.id}>
            <AppText variant="eyebrow" tone="subtle">
              {m.match.matchDatetime ? relativeDayTime(m.match.matchDatetime, club.timezone) : "Date à confirmer"}
            </AppText>
            <AppText variant="headline">{`${m.match.teamName ?? ""} vs ${m.match.opponentName ?? ""}`}</AppText>
            <View style={styles.row}>
              <Badge tone={filled === roles.length ? "success" : "warning"} label={`${filled}/${roles.length} postes`} />
              {m.hasConflict ? <Badge tone="danger" label="Conflit" /> : null}
            </View>
            {roles.map((r) => {
              const slot = m.assignments[r.key];
              return (
                <ListRow
                  key={r.role}
                  title={r.label}
                  subtitle={slot ? `${slot.licencie.firstName} ${slot.licencie.lastName}${slot.hasConflict && slot.conflictReason ? ` · ${slot.conflictReason}` : ""}` : "À pourvoir"}
                  trailing={
                    manager ? (
                      slot ? (
                        <Button label="Retirer" variant="ghost" onPress={() => remove.mutate({ matchId: m.match.id, role: r.role })} />
                      ) : (
                        <Button label="Choisir" variant="secondary" onPress={() => setOpen({ matchId: m.match.id, role: r.role, label: r.label })} />
                      )
                    ) : undefined
                  }
                />
              );
            })}
          </Card>
        );
      })}
      {open && manager ? <TableSuggestionsSheet visible onClose={() => setOpen(null)} matchId={open.matchId} role={open.role} roleLabel={open.label} as={manager} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: spacing.sm } });
