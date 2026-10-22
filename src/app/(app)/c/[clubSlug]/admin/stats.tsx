import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, type BadgeTone } from "@/components/ui";
import { colors, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";

type Tracking = Awaited<ReturnType<typeof adminApi.emarqueTracking>>[number];

const STATE: Record<Tracking["state"], { label: string; tone: BadgeTone; bar: string; order: number }> = {
  needs_review: { label: "À vérifier, non publié", tone: "danger", bar: colors.danger, order: 0 },
  error: { label: "Erreur de lecture", tone: "danger", bar: colors.danger, order: 1 },
  not_available: { label: "Pas de feuille e-Marque", tone: "warning", bar: colors.warning, order: 2 },
  processing: { label: "Lecture en cours", tone: "info", bar: colors.info, order: 3 },
  waiting: { label: "En attente de la feuille", tone: "info", bar: colors.info, order: 4 },
  published: { label: "Stats publiées", tone: "success", bar: colors.success, order: 5 },
};

function when(iso: string | null, timeZone: string): string {
  return iso ? new Date(iso).toLocaleString("fr-FR", { timeZone, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
}

/**
 * Suivi des stats (admins) : chaque match joué, l'état de sa feuille
 * e-Marque (cherchée, lue, contrôlée, publiée) et « Relancer ». Comme sur le site.
 */
export default function AdminStatsScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const queryClient = useQueryClient();
  const tracking = useQuery({ queryKey: queryKeys.adminEmarque(slug), queryFn: () => adminApi.emarqueTracking(slug) });
  const [relaunched, setRelaunched] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const matches = [...(tracking.data ?? [])].sort((a, b) => STATE[a.state].order - STATE[b.state].order || (b.matchDatetime ?? "").localeCompare(a.matchDatetime ?? ""));
  const count = (state: Tracking["state"]) => matches.filter((m) => m.state === state).length;

  const relaunch = async (matchId: string) => {
    setError(null);
    try {
      await adminApi.relaunchEmarque(slug, matchId);
      setRelaunched((set) => new Set(set).add(matchId));
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminEmarque(slug) });
    } catch (err) {
      setError(humanMessage(err));
    }
  };

  return (
    <AdminScreen title="Suivi des stats" onRefresh={() => void tracking.refetch()}>
      {() =>
        tracking.isPending ? (
          <CardSkeletons count={3} />
        ) : tracking.isError ? (
          <ErrorState message={humanMessage(tracking.error)} onRetry={() => void tracking.refetch()} />
        ) : matches.length === 0 ? (
          <EmptyState icon="stats-chart-outline" title="Aucun match joué cette saison" message="Les matchs apparaîtront ici dès qu'ils seront joués." />
        ) : (
          <>
            <View style={styles.badges}>
              <Badge tone="success" label={`${count("published")} publiée${count("published") > 1 ? "s" : ""}`} />
              <Badge tone="info" label={`${count("waiting") + count("processing")} en cours`} />
              {count("needs_review") + count("error") ? <Badge tone="danger" label={`${count("needs_review") + count("error")} à vérifier`} /> : null}
              {count("not_available") ? <Badge tone="warning" label={`${count("not_available")} sans feuille`} /> : null}
            </View>
            <AppText variant="meta" tone="muted">
              La feuille est cherchée sur FBI toutes les 15 min pendant 6 h après le match, puis toutes les heures jusqu’à 48 h, puis toutes les 6 h jusqu’à 7 jours. Rien n’est publié si un contrôle échoue (score, points, maillots).
            </AppText>
            {error ? <Banner tone="danger" message={error} onClose={() => setError(null)} /> : null}
            {matches.map((m) => {
              const state = STATE[m.state];
              const team = m.teamName ?? "Équipe";
              const title = m.isHome === false ? `${m.opponentName ?? "?"} – ${team}` : `${team} – ${m.opponentName ?? "?"}`;
              const done = relaunched.has(m.matchId);
              return (
                <Card key={m.matchId} style={[styles.card, { borderLeftColor: state.bar }]}>
                  <View style={styles.head}>
                    <View style={styles.flex}>
                      <AppText variant="eyebrow" tone="muted">{`Rencontre ${m.numero ?? "?"}`}</AppText>
                      <AppText variant="headline">{title}</AppText>
                      <AppText variant="meta" tone="muted">
                        {`${when(m.matchDatetime, club.timezone)}${m.scoreHome !== null && m.scoreAway !== null ? ` · ${m.scoreHome} – ${m.scoreAway}` : ""}`}
                      </AppText>
                    </View>
                    <Badge tone={state.tone} label={state.label} />
                  </View>
                  {m.state === "waiting" || m.state === "processing" ? <AppText variant="meta">{`Prochain essai : ${m.nextCheckAt ? when(m.nextCheckAt, club.timezone) : "au prochain passage"}`}</AppText> : null}
                  {m.lastCheckAt ? <AppText variant="meta">{`Dernier essai : ${when(m.lastCheckAt, club.timezone)}${m.lastCheckResult ? ` — ${m.lastCheckResult}` : ""}`}</AppText> : null}
                  {m.clubPlayersTotal > 0 ? (
                    <AppText variant="meta" tone={m.clubPlayersLinked < m.clubPlayersTotal ? "warning" : "default"}>{`Joueurs du club rattachés : ${m.clubPlayersLinked}/${m.clubPlayersTotal}`}</AppText>
                  ) : null}
                  {m.problems.map((problem, i) => (
                    <AppText key={i} variant="meta" tone="danger">
                      {`• ${problem}`}
                    </AppText>
                  ))}
                  <View style={styles.actions}>
                    {m.state !== "processing" ? <Button label={done ? "Relancé" : "Relancer"} variant="secondary" disabled={done} onPress={() => void relaunch(m.matchId)} /> : null}
                    <Button label="Ouvrir le match" variant="ghost" onPress={() => router.push(`/c/${slug}/matchs/${m.matchId}`)} />
                  </View>
                  {done ? (
                    <AppText variant="meta" tone="success">
                      Essai au prochain passage (moins de 15 min).
                    </AppText>
                  ) : null}
                </Card>
              );
            })}
          </>
        )
      }
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: { borderLeftWidth: 4 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
