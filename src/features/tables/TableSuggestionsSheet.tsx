import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { tablesApi, type TableRole } from "@/api/endpoints/tables";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, CardSkeletons, ListRow, SectionHeader, Sheet } from "@/components/ui";
import { spacing } from "@/design";

/**
 * Suggestions EXPLIQUÉES pour un poste (raisons, nombre de tables cette
 * saison, conflits). La personne responsable choisit — jamais d'affectation
 * automatique. Conflit (même personne sur un autre match) : confirmation explicite.
 */
export function TableSuggestionsSheet({ visible, onClose, matchId, role, roleLabel, as }: { visible: boolean; onClose: () => void; matchId: string; role: TableRole; roleLabel: string; as: string }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<{ licencieId: string; message: string } | null>(null);
  const suggestions = useQuery({ queryKey: queryKeys.tableSuggestions(club.clubSlug, matchId, role), queryFn: () => tablesApi.suggestions(club.clubSlug, as, matchId, role), enabled: visible });
  const assign = useMutation({
    mutationFn: (v: { licencieId: string; force: boolean }) => tablesApi.assign(club.clubSlug, as, matchId, role, v.licencieId, v.force),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tables(club.clubSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
      setConflict(null);
      onClose();
    },
    onError: (e, v) => {
      if (e instanceof ApiError && e.status === 409 && !v.force) setConflict({ licencieId: v.licencieId, message: e.message });
    },
  });
  const data = suggestions.data;
  return (
    <Sheet visible={visible} title={roleLabel} onClose={onClose}>
      {suggestions.isPending ? <CardSkeletons count={2} /> : null}
      {suggestions.error ? <Banner tone="danger" message={humanMessage(suggestions.error)} /> : null}
      {conflict ? (
        <View style={styles.box}>
          <Banner tone="warning" message={conflict.message} />
          <Button label="Affecter quand même" variant="secondary" loading={assign.isPending} onPress={() => assign.mutate({ licencieId: conflict.licencieId, force: true })} />
        </View>
      ) : null}
      {assign.error && !conflict ? <Banner tone="danger" message={humanMessage(assign.error)} /> : null}
      {data ? (
        <>
          {[
            { title: "Recommandé·e·s", list: data.recommended },
            { title: "Disponibles", list: data.available },
          ].map((group) =>
            group.list.length ? (
              <View key={group.title} style={styles.box}>
                <SectionHeader title={group.title} />
                {group.list.map((c) => (
                  <ListRow
                    key={c.licencie.id}
                    title={`${c.licencie.firstName} ${c.licencie.lastName}`}
                    subtitle={[...c.reasons.map((r) => r.label), `${c.seasonAssignmentCount} table${c.seasonAssignmentCount > 1 ? "s" : ""} cette saison`].join(" · ")}
                    trailing={c.isCurrentHolder ? <Badge tone="info" label="Actuel" /> : undefined}
                    onPress={() => assign.mutate({ licencieId: c.licencie.id, force: false })}
                  />
                ))}
              </View>
            ) : null,
          )}
          {data.unavailable.length ? (
            <View style={styles.box}>
              <SectionHeader title="Indisponibles" />
              {data.unavailable.map((c) => (
                <ListRow key={c.licencie.id} title={`${c.licencie.firstName} ${c.licencie.lastName}`} subtitle={c.reason} />
              ))}
            </View>
          ) : null}
          {!data.recommended.length && !data.available.length ? (
            <AppText variant="callout" tone="muted">
              Personne de disponible pour ce poste.
            </AppText>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({ box: { gap: spacing.sm } });
