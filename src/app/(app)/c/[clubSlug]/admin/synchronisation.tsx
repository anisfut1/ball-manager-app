import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type SyncRunDto } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, SectionHeader, type BadgeTone } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";
import { EMARQUE_STATUS } from "@/features/matches/detail/labels";
import { currentSeasonStart } from "@/lib/season";

const RUN_STATUS: Record<SyncRunDto["status"], { label: string; tone: BadgeTone }> = {
  running: { label: "En cours", tone: "info" },
  success: { label: "Réussie", tone: "success" },
  partial: { label: "Partielle", tone: "warning" },
  error: { label: "Erreur", tone: "danger" },
};

function when(iso: string | null, timeZone: string): string {
  return iso ? new Date(iso).toLocaleString("fr-FR", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

function duration(startedAt: string, finishedAt: string | null): string | null {
  if (!finishedAt) return null;
  const seconds = Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000));
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/**
 * Synchronisation (admins) : dernières exécutions FFBB / FBI, matchs de la
 * saison par statut e-Marque, et relance de la synchro FFBB. Comme sur le site.
 */
export default function AdminSyncScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: queryKeys.adminSync(slug),
    queryFn: async () => {
      const [runs, matches] = await Promise.all([adminApi.syncRuns(slug), adminApi.matches(slug, { from: currentSeasonStart().toISOString() })]);
      return { runs: runs.slice(0, 10), matches };
    },
  });
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger" | "info"; message: string } | null>(null);

  const syncNow = async () => {
    setSyncing(true);
    setNotice({ tone: "info", message: "Synchronisation FFBB en cours… (jusqu'à quelques minutes)" });
    try {
      const result = await adminApi.triggerFfbbSync(slug);
      setNotice({ tone: "success", message: `Synchronisation terminée (${result.status}).` });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminSync(slug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrations(slug) });
    } catch (error) {
      setNotice({ tone: "danger", message: humanMessage(error) });
    } finally {
      setSyncing(false);
    }
  };

  const counts = new Map<string, number>();
  for (const m of data.data?.matches ?? []) counts.set(m.emarqueStatus, (counts.get(m.emarqueStatus) ?? 0) + 1);

  return (
    <AdminScreen title="Synchronisation" onRefresh={() => void data.refetch()}>
      {() => (
        <>
          <AppText variant="callout" tone="muted">
            Les synchronisations tournent seules. Ce tableau sert au suivi ; la relance FFBB est un outil de dépannage.
          </AppText>
          {notice ? <Banner tone={notice.tone} message={notice.message} /> : null}
          <Button label="Relancer la synchro FFBB maintenant" variant="secondary" loading={syncing} onPress={() => void syncNow()} fullWidth />

          {data.isPending ? (
            <CardSkeletons count={3} />
          ) : data.isError ? (
            <ErrorState message={humanMessage(data.error)} onRetry={() => void data.refetch()} />
          ) : (
            <>
              <SectionHeader title="Matchs par statut e-Marque" />
              <View style={styles.grid}>
                {Object.entries(EMARQUE_STATUS).map(([status, meta]) => {
                  const count = counts.get(status) ?? 0;
                  return (
                    <View key={status} style={[styles.tile, count === 0 && styles.tileEmpty]}>
                      <AppText variant="meta" tone="muted" numberOfLines={2}>
                        {meta.label}
                      </AppText>
                      <AppText variant="numeric" tone={count === 0 ? "subtle" : "default"}>
                        {String(count)}
                      </AppText>
                    </View>
                  );
                })}
              </View>
              <AppText variant="meta" tone="muted">
                Saison en cours.
              </AppText>

              <SectionHeader title="Dernières synchronisations" />
              {data.data.runs.length === 0 ? (
                <EmptyState icon="sync-outline" title="Aucune synchronisation pour l'instant" />
              ) : (
                <Card>
                  {data.data.runs.map((run) => {
                    const meta = RUN_STATUS[run.status];
                    const took = duration(run.startedAt, run.finishedAt);
                    return (
                      <View key={run.id} style={styles.run}>
                        <View style={styles.runHead}>
                          <AppText variant="bodyStrong">{run.provider.toUpperCase()}</AppText>
                          <AppText variant="meta" tone="muted" style={styles.flex}>
                            {`${when(run.startedAt, club.timezone)}${took ? ` · ${took}` : ""}`}
                          </AppText>
                          <Badge tone={meta.tone} label={meta.label} />
                        </View>
                        {run.errorLog ? (
                          <AppText variant="meta" tone="danger" style={styles.error}>
                            {run.errorLog}
                          </AppText>
                        ) : null}
                      </View>
                    );
                  })}
                </Card>
              )}
            </>
          )}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: { width: "48%", flexGrow: 1, gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  tileEmpty: { backgroundColor: colors.surface },
  run: { gap: spacing.xs, paddingVertical: spacing.xs },
  runHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  error: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
});
