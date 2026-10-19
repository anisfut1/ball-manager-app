import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { derogationsApi, type DerogationSummary } from "@/api/endpoints/derogations";
import { ApiError, humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub, useSession } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, Screen } from "@/components/ui";
import { colors, spacing } from "@/design";
import { ClubHeader } from "@/features/home/ClubHeader";
import { groupRequests, isArchivedRequest, NO_COORDINATOR_MESSAGE } from "@/features/derogations/labels";
import { OfficialDerogationsList } from "@/features/derogations/Official";
import { RequestCard } from "@/features/derogations/parts";
import { useDerogationActor } from "@/features/derogations/useDerogationActor";

/**
 * Onglet Dérogations — copie de l'espace public du web :
 *  - sans rôle → « Accès réservé » ;
 *  - coach / coordinateur → demandes internes (sections, archives) ;
 *  - admin du club OU coordinateur → + dérogations officielles FBI.
 * Le serveur revérifie chaque droit (403 sinon).
 */
export default function DerogationsScreen() {
  return <DerogationsView />;
}

/** `tab` : onglet de la barre du bas (en-tête du club), sinon écran empilé. */
export function DerogationsView({ tab = false }: { tab?: boolean }) {
  const club = useActiveClub();
  const { as, hasAccess, official, loading } = useDerogationActor();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.derogations(club.clubSlug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.derogationContext(club.clubSlug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.officialDerogations(club.clubSlug) });
  };

  return (
    <Screen refreshing={false} onRefresh={refresh}>
      {tab ? null : <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Retour", headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />}
      <ClubHeader title="Dérogations" />
      {loading ? <CardSkeletons count={3} /> : !hasAccess || !as ? <Restricted /> : <Requests as={as} />}
      {official ? <OfficialSection as={official} /> : null}
    </Screen>
  );
}

function Restricted() {
  const { person } = useSession();
  return (
    <Card style={styles.gap}>
      <Ionicons name="lock-closed-outline" size={28} color={colors.muted} />
      <AppText variant="title">Accès réservé</AppText>
      <AppText variant="callout" tone="muted">
        {`Les dérogations sont réservées aux coachs, au coordinateur et aux administrateurs du club.${person ? ` Tu es reconnu·e comme ${person.firstName} ${person.lastName}, qui n'a aucun de ces rôles.` : ""} Un administrateur peut te l'attribuer depuis la liste des joueurs.`}
      </AppText>
    </Card>
  );
}

function Requests({ as }: { as: string }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const context = useQuery({ queryKey: queryKeys.derogationContext(club.clubSlug), queryFn: () => derogationsApi.context(club.clubSlug, as) });
  const list = useQuery({ queryKey: queryKeys.derogations(club.clubSlug), queryFn: () => derogationsApi.list(club.clubSlug, as) });
  const [showArchives, setShowArchives] = useState(false);
  const [now] = useState(() => new Date());
  const remove = useMutation({ mutationFn: (id: string) => derogationsApi.remove(club.clubSlug, as, id), onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.derogations(club.clubSlug) }) });

  const error = context.error ?? list.error;
  if (error instanceof ApiError && error.status === 403) return <Restricted />;
  const manager = context.data?.canManage ?? false;
  const tz = context.data?.timezone ?? club.timezone;
  const requests = list.data?.requests ?? [];
  const active = requests.filter((r) => !isArchivedRequest(r, now));
  const archived = requests.filter((r) => isArchivedRequest(r, now));
  const sections = groupRequests(active, manager);
  const open = (r: DerogationSummary) => router.push(`/c/${club.clubSlug}/derogations/${r.id}`);
  const confirmDelete = (id: string) =>
    Alert.alert("Supprimer définitivement ?", "Cette demande et sa conversation seront supprimées. La dérogation officielle FBI n'est pas concernée.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => remove.mutate(id) },
    ]);

  return (
    <View style={styles.page}>
      <AppText variant="callout" tone="muted">
        {manager ? "Les demandes de changement de date envoyées par les coachs. Tu t'occupes des démarches officielles, la conversation garde la trace de tout." : "Demande au coordinateur de déplacer un match, puis suis sa réponse ici."}
      </AppText>
      {context.data?.canCreate ? <Button label="Nouvelle demande" icon={<Ionicons name="add" size={18} color="#FFFFFF" />} onPress={() => router.push(`/c/${club.clubSlug}/derogations/nouvelle`)} style={styles.start} /> : null}
      {error ? <ErrorState title="Impossible de charger les demandes" message={humanMessage(error)} onRetry={() => void Promise.all([context.refetch(), list.refetch()])} /> : null}
      {(context.isPending || list.isPending) && !error ? <CardSkeletons count={3} /> : null}
      {context.data && !context.data.coordinatorsConfigured ? <Banner tone="warning" message={NO_COORDINATOR_MESSAGE} /> : null}
      {list.data && requests.length === 0 ? (
        <EmptyState icon="calendar-outline" title="Aucune demande de dérogation" message={manager ? "Les demandes des coachs apparaîtront ici dès leur envoi." : "Besoin de déplacer un match ? Choisis le match, la date et le créneau : le coordinateur reçoit ta demande."} />
      ) : null}
      {list.data && requests.length > 0 ? (
        <>
          {sections.map((s) => (
            <View key={s.key} style={styles.section}>
              <View style={styles.sectionTitle}>
                <AppText variant="headline">{s.title}</AppText>
                <View style={styles.count}>
                  <AppText variant="meta" tone="muted">
                    {String(s.requests.length)}
                  </AppText>
                </View>
              </View>
              <AppText variant="meta" tone="muted">
                {s.description}
              </AppText>
              {s.requests.map((r) => (
                <RequestCard key={r.id} request={r} manager={manager} timezone={tz} now={now} onPress={() => open(r)} />
              ))}
            </View>
          ))}
          {sections.length === 0 ? (
            <AppText variant="meta" tone="muted">
              Aucune demande en cours.
            </AppText>
          ) : null}
          {archived.length ? (
            <View style={styles.section}>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showArchives }} onPress={() => setShowArchives(!showArchives)} style={styles.archiveToggle}>
                <Ionicons name="archive-outline" size={16} color={colors.muted} />
                <AppText variant="bodyStrong" tone="muted">
                  Archives
                </AppText>
                <View style={styles.count}>
                  <AppText variant="meta" tone="muted">
                    {String(archived.length)}
                  </AppText>
                </View>
                <Ionicons name={showArchives ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
              </Pressable>
              <AppText variant="meta" tone="subtle">
                Demandes terminées, annulées ou dont le match est passé
              </AppText>
              {showArchives
                ? archived.map((r) => (
                    <View key={r.id} style={styles.gap}>
                      <RequestCard request={r} manager={manager} timezone={tz} now={now} onPress={() => open(r)} />
                      {manager && (r.status === "COMPLETED" || r.status === "CANCELLED") ? (
                        <Button label="Supprimer" variant="ghost" icon={<Ionicons name="trash-outline" size={16} color={colors.danger} />} loading={remove.isPending && remove.variables === r.id} onPress={() => confirmDelete(r.id)} style={styles.end} />
                      ) : null}
                    </View>
                  ))
                : null}
              {remove.error ? <Banner tone="danger" message={humanMessage(remove.error)} /> : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Dérogations officielles FBI : admin du club ou coordinateur (comme le web). */
function OfficialSection({ as }: { as: string }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: queryKeys.officialDerogations(club.clubSlug), queryFn: () => derogationsApi.officialList(club.clubSlug, as) });
  // Rôle retiré entre-temps : le serveur fait foi.
  if (q.error instanceof ApiError && (q.error.status === 403 || q.error.status === 401)) return null;
  return (
    <View style={styles.section}>
      <AppText variant="title">Dérogations officielles (FBI)</AppText>
      <AppText variant="meta" tone="muted">
        Dérogations FBI connues pour le club : accepte ou refuse celles qui attendent une réponse. Pour en créer une, ouvre le match concerné (onglet Matchs) → « Créer une dérogation ».
      </AppText>
      {q.isPending ? <CardSkeletons count={3} /> : null}
      {q.error ? <ErrorState title="Impossible de charger les dérogations" message={humanMessage(q.error)} onRetry={() => void q.refetch()} /> : null}
      {q.data ? (
        <OfficialDerogationsList
          derogations={q.data.derogations}
          respond={(derogationId, body) => derogationsApi.respond(club.clubSlug, as, derogationId, body)}
          onChanged={() => void queryClient.invalidateQueries({ queryKey: queryKeys.officialDerogations(club.clubSlug) })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  gap: { gap: spacing.sm },
  start: { alignSelf: "flex-start" },
  end: { alignSelf: "flex-end" },
  section: { gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  count: { paddingHorizontal: spacing.sm, borderRadius: 999, backgroundColor: colors.surfaceMuted },
  archiveToggle: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
});
