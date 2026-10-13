import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { TABLE_ROLES } from "@/api/endpoints/tables";
import type { Dto } from "@/api/types";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Badge, CardSkeletons, ErrorState, Screen, SectionHeader, initials } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { MATCH_TZ } from "@/features/matches/match-model";
import { useClubInfo } from "@/features/matches/useClubInfo";

type PlayerMatch = Dto<"PublicPlayerMatchDto">;

const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: MATCH_TZ, day: "2-digit", month: "short" }) : null);
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("fr-FR", { timeZone: MATCH_TZ, hour: "2-digit", minute: "2-digit" }) : null);

/**
 * Fiche joueur, comme le web (PublicPlayerProfile) : en-tête photo, chiffres
 * clés de la saison, meilleur match, prochain match, derniers matchs, tables
 * de marque. Valeurs réelles de l'API uniquement ; « — » quand une donnée manque.
 */
export default function PlayerScreen() {
  const { licencieId = "" } = useLocalSearchParams<{ licencieId: string }>();
  const club = useClubInfo();
  const accent = useClubAccent();
  const query = useQuery({ queryKey: queryKeys.player(club.slug, licencieId), queryFn: () => clubSpaceApi.player(club.slug, licencieId) });
  const base = `/c/${club.slug}/matchs`;
  const p = query.data;

  return (
    <Screen edges={[]} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ headerShown: true, title: "Fiche joueur", headerBackTitle: "Retour" }} />
      {query.isPending ? <CardSkeletons count={3} /> : null}
      {query.error ? <ErrorState message={humanMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {p ? (
        <>
          <View style={[styles.hero, { backgroundColor: "#141414" }]}>
            <View style={[styles.glow, { backgroundColor: accent.accent }]} />
            {p.player.photoUrl ? (
              <Image source={{ uri: p.player.photoUrl }} style={styles.portrait} contentFit="cover" accessibilityLabel={`Photo de ${p.player.firstName} ${p.player.lastName}`} />
            ) : (
              <View style={[styles.portrait, styles.portraitEmpty]}>
                <AppText variant="display" color="rgba(255,255,255,0.7)">
                  {initials(p.player.firstName, p.player.lastName)}
                </AppText>
              </View>
            )}
            <AppText variant="eyebrow" color="rgba(255,255,255,0.65)">
              {club.name}
            </AppText>
            <AppText variant="headline" color="rgba(255,255,255,0.85)">
              {p.player.firstName}
            </AppText>
            <AppText variant="display" color="#FFFFFF" style={styles.lastName}>
              {p.player.lastName}
            </AppText>
            <View style={styles.chips}>
              {p.teams.map((t) => (
                <HeroChip key={`${t.relation}-${t.id}`} icon={t.relation === "COACH" ? "megaphone-outline" : "shirt-outline"} label={t.relation === "COACH" ? `Coach ${t.name}` : t.name} />
              ))}
              {!p.teams.some((t) => t.relation === "PLAYER") && p.player.categoryLabel ? <HeroChip icon="shirt-outline" label={p.player.categoryLabel} /> : null}
            </View>
          </View>

          <SectionHeader title={p.season.matchesPlayed > 0 ? `Cette saison · ${p.season.wins} victoire${p.season.wins > 1 ? "s" : ""} · ${p.season.losses} défaite${p.season.losses > 1 ? "s" : ""}` : "Cette saison"} />
          <View style={styles.figures}>
            <Figure label="Matchs joués" value={p.season.matchesPlayed} />
            <Figure label="Points" value={p.season.matchesWithStats > 0 ? p.season.totalPoints : null} />
            <Figure label="Moy. / match" value={p.season.pointsPerMatch !== null ? p.season.pointsPerMatch.toLocaleString("fr-FR") : null} />
            <Figure label="Tables faites" value={p.tables.done} />
          </View>
          {p.season.matchesWithStats > 0 ? (
            <AppText variant="meta" tone="muted">
              {p.season.threePointsMade} tir{p.season.threePointsMade > 1 ? "s" : ""} à 3 pts · {p.season.freeThrowsMade} lancer{p.season.freeThrowsMade > 1 ? "s" : ""} franc{p.season.freeThrowsMade > 1 ? "s" : ""} · {minutes(p.season.secondsPlayed)} de jeu
            </AppText>
          ) : null}
          {p.season.bestPoints !== null && p.season.bestPoints > 0 && p.season.bestPointsMatchId ? (
            <RowCard onPress={() => router.push(`${base}/${p.season.bestPointsMatchId}?tab=statistiques`)} leading={<Round icon="flame" />}>
              <AppText variant="eyebrow" tone="subtle">
                Meilleur match
              </AppText>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {p.season.bestPoints} pts
                {(() => {
                  const best = p.recentMatches.find((m) => m.matchId === p.season.bestPointsMatchId);
                  return best ? ` · ${best.isHome ? "vs" : "à"} ${best.opponentName ?? "adversaire"}` : "";
                })()}
              </AppText>
            </RowCard>
          ) : null}

          {p.nextMatch ? (
            <>
              <SectionHeader title="Prochain match" />
              <RowCard onPress={() => router.push(`${base}/${p.nextMatch?.matchId}`)} leading={<DateBlock iso={p.nextMatch.matchDatetime} />}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {p.nextMatch.isHome ? "vs" : "à"} {p.nextMatch.opponentName ?? "Adversaire à confirmer"}
                </AppText>
                <AppText variant="meta" tone="muted" numberOfLines={1}>
                  {[p.nextMatch.teamName, p.nextMatch.isHome ? "Domicile" : "Extérieur", time(p.nextMatch.matchDatetime)].filter(Boolean).join(" · ")}
                </AppText>
              </RowCard>
            </>
          ) : null}

          <SectionHeader title="Derniers matchs" />
          {p.recentMatches.length === 0 ? (
            <AppText variant="meta" tone="muted">
              Aucun match publié cette saison pour l&apos;instant.
            </AppText>
          ) : (
            <View style={styles.list}>
              {p.recentMatches.map((m, i) => (
                <RecentRow key={m.matchId} match={m} first={i === 0} onPress={() => router.push(`${base}/${m.matchId}?tab=statistiques`)} />
              ))}
            </View>
          )}

          <SectionHeader title="Tables de marque" />
          <View style={styles.card}>
            <View style={styles.rowCenter}>
              <Round icon="clipboard-outline" />
              <AppText variant="body" style={styles.flex}>
                {p.tables.done > 0 ? `${p.tables.done} table${p.tables.done > 1 ? "s" : ""} tenue${p.tables.done > 1 ? "s" : ""} cette saison` : "Aucune table tenue cette saison pour l'instant."}
              </AppText>
            </View>
            {p.tables.byRole.length || p.tables.upcoming ? (
              <View style={styles.chipsDark}>
                {p.tables.byRole.map((r) => (
                  <Badge key={r.role} label={`${TABLE_ROLES.find((x) => x.role === r.role)?.label ?? r.role} × ${r.count}`} />
                ))}
                {p.tables.upcoming > 0 ? <Badge tone="info" label={`${p.tables.upcoming} à venir`} /> : null}
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function HeroChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.heroChip}>
      <Ionicons name={icon} size={13} color="#FFFFFF" />
      <AppText variant="meta" color="#FFFFFF" style={styles.bold}>
        {label}
      </AppText>
    </View>
  );
}

function Figure({ label, value }: { label: string; value: ReactNode | null }) {
  return (
    <View style={styles.figure}>
      <AppText variant="numeric" style={styles.figureValue}>
        {value ?? "—"}
      </AppText>
      <AppText variant="meta" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

function Round({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const accent = useClubAccent();
  return (
    <View style={[styles.round, { backgroundColor: accent.soft }]}>
      <Ionicons name={icon} size={20} color={accent.text} />
    </View>
  );
}

function RowCard({ children, leading, onPress }: { children: ReactNode; leading: ReactNode; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, styles.rowCenter, pressed && styles.pressed]}>
      {leading}
      <View style={styles.flex}>{children}</View>
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

function DateBlock({ iso }: { iso: string | null }) {
  const accent = useClubAccent();
  if (!iso) return <Round icon="trophy-outline" />;
  const d = new Date(iso);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("fr-FR", { timeZone: MATCH_TZ, ...o }).replace(".", "");
  return (
    <View style={[styles.dateBlock, { backgroundColor: accent.soft }]}>
      <AppText variant="meta" color={accent.text} style={styles.upper}>
        {part({ weekday: "short" })}
      </AppText>
      <AppText variant="numeric" color={accent.text}>
        {part({ day: "2-digit" })}
      </AppText>
      <AppText variant="meta" color={accent.text} style={styles.upper}>
        {part({ month: "short" })}
      </AppText>
    </View>
  );
}

const RESULT: Record<"WIN" | "LOSS" | "DRAW", { letter: string; bg: string; fg: string }> = {
  WIN: { letter: "V", bg: colors.successSoft, fg: colors.success },
  LOSS: { letter: "D", bg: colors.dangerSoft, fg: colors.danger },
  DRAW: { letter: "N", bg: colors.surfaceMuted, fg: colors.muted },
};

function RecentRow({ match, first, onPress }: { match: PlayerMatch; first: boolean; onPress: () => void }) {
  const result = match.result ? RESULT[match.result] : null;
  const score = match.scoreHome !== null && match.scoreAway !== null ? (match.isHome ? `${match.scoreHome}-${match.scoreAway}` : `${match.scoreAway}-${match.scoreHome}`) : null;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.recent, !first && styles.sep, pressed && styles.pressed]}>
      <View style={[styles.result, { backgroundColor: result?.bg ?? colors.surfaceMuted }]}>
        <AppText variant="bodyStrong" color={result?.fg ?? colors.subtle}>
          {result?.letter ?? "–"}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {match.isHome ? "vs" : "à"} {match.opponentName ?? "Adversaire"}
        </AppText>
        <AppText variant="meta" tone="muted" numberOfLines={1}>
          {[shortDate(match.matchDatetime), score, match.teamName, match.jerseyNumber ? `#${match.jerseyNumber}` : null, match.isCaptain ? "Capitaine" : null].filter(Boolean).join(" · ")}
        </AppText>
      </View>
      <View style={styles.pts}>
        <AppText variant="numeric">{match.points ?? "—"}</AppText>
        <AppText variant="meta" tone="muted">
          {match.secondsPlayed !== null ? `pts · ${minutes(match.secondsPlayed)}` : "pts"}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, borderRadius: radius.xl, overflow: "hidden" },
  glow: { position: "absolute", width: 320, height: 320, borderRadius: 160, top: -160, left: -120, opacity: 0.55 },
  portrait: { width: 128, height: 128, borderRadius: 28, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)", marginBottom: spacing.md },
  portraitEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  lastName: { textTransform: "uppercase", textAlign: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.xs, marginTop: spacing.sm },
  heroChip: { flexDirection: "row", alignItems: "center", gap: spacing.xs, height: 28, paddingHorizontal: spacing.sm + 2, borderRadius: radius.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(255,255,255,0.1)" },
  bold: { fontWeight: "600" },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  figure: { flexBasis: "47%", flexGrow: 1, gap: 2, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  figureValue: { fontSize: 28, lineHeight: 32 },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pressed: { opacity: 0.85 },
  flex: { flex: 1 },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dateBlock: { width: 56, height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  upper: { textTransform: "uppercase", fontSize: 10, lineHeight: 12 },
  list: { borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden", ...shadows.card },
  recent: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  result: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  pts: { alignItems: "flex-end" },
  chipsDark: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
});
