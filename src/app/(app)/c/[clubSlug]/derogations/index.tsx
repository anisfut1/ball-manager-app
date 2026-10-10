import { router, Stack } from "expo-router";
import { FlatList, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { derogationsApi } from "@/api/endpoints/derogations";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { Badge, Button, Card, CardSkeletons, EmptyState, ErrorState, ListRow, Screen } from "@/components/ui";
import { spacing } from "@/design";
import { STATUS } from "@/features/derogations/labels";
import { useDerogationActor } from "@/features/derogations/useDerogationActor";
import { relativeDayTime } from "@/lib/dates";

/** Demandes de dérogation (coach → coordinateur), visibles selon les droits renvoyés par l'API. */
export default function DerogationsScreen() {
  const club = useActiveClub();
  const as = useDerogationActor();
  const context = useQuery({ queryKey: queryKeys.derogationContext(club.clubSlug), queryFn: () => derogationsApi.context(club.clubSlug, as!), enabled: !!as });
  const list = useQuery({ queryKey: queryKeys.derogations(club.clubSlug), queryFn: () => derogationsApi.list(club.clubSlug, as!), enabled: !!as });
  return (
    <Screen scroll={false}>
      <Stack.Screen options={{ headerShown: true, title: "Dérogations", headerBackTitle: "Retour" }} />
      <FlatList
        data={list.data?.requests ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.content}
        refreshing={list.isRefetching}
        onRefresh={() => void list.refetch()}
        ListHeaderComponent={
          <>
            {context.data?.canCreate ? <Button label="Nouvelle demande" onPress={() => router.push(`/c/${club.clubSlug}/derogations/nouvelle`)} /> : null}
            {list.isPending ? <CardSkeletons count={2} /> : null}
            {list.error ? <ErrorState message={humanMessage(list.error)} onRetry={() => void list.refetch()} /> : null}
          </>
        }
        ListEmptyComponent={list.data ? <EmptyState icon="swap-horizontal-outline" title="Aucune demande" message="Les demandes de changement d'horaire ou de salle apparaîtront ici." /> : null}
        renderItem={({ item }) => (
          <Card padded={false} style={styles.card}>
            <ListRow
              title={`${item.match.teamName ?? ""} vs ${item.match.opponentName ?? ""}`}
              subtitle={[`Demandé : ${relativeDayTime(item.requestedStartAt, club.timezone)}`, item.lastMessage ? `${item.lastMessage.authorDisplayName} : ${item.lastMessage.excerpt}` : null].filter(Boolean).join("\n")}
              trailing={<Badge tone={STATUS[item.status].tone} label={item.needsCoordinatorAttention ? "À traiter" : STATUS[item.status].label} />}
              onPress={() => router.push(`/c/${club.clubSlug}/derogations/${item.id}`)}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ content: { padding: spacing.gutter, gap: spacing.md, paddingBottom: spacing.xxxl * 2 }, card: { paddingHorizontal: spacing.lg } });
