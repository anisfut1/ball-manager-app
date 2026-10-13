import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { TABLE_ROLES } from "@/api/endpoints/tables";
import type { Dto } from "@/api/types";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Avatar, CardSkeletons, EmptyState, ErrorState, Screen, initials } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { useClubInfo } from "@/features/matches/useClubInfo";

type Entry = Dto<"TableLeaderboardEntryDto">;

const MEDAL: Record<number, { ring: string; badge: string; ink: string }> = {
  1: { ring: "#E7B416", badge: "#E7B416", ink: "#3a2c00" },
  2: { ring: "#A9B1BB", badge: "#A9B1BB", ink: "#1d2228" },
  3: { ring: "#C9824A", badge: "#C9824A", ink: "#2e1706" },
};

/** Classement des tables de marque, comme le web : podium (2e, 1er, 3e) puis la liste ; ex æquo = même rang (donné par l'API). */
export default function TableLeaderboardScreen() {
  const club = useClubInfo();
  const accent = useClubAccent();
  const query = useQuery({ queryKey: queryKeys.tableLeaderboard(club.slug), queryFn: () => clubSpaceApi.tableLeaderboard(club.slug) });
  const board = query.data;
  const open = (e: Entry) => () => router.push(`/c/${club.slug}/joueurs/${e.licencie.id}`);
  const podium = board?.entries.slice(0, 3) ?? [];
  const order = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium.length === 2 ? [podium[1], podium[0]] : podium;

  return (
    <Screen edges={[]} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <Stack.Screen options={{ headerShown: true, title: "Classement", headerBackTitle: "Tables" }} />
      <AppText variant="callout" tone="muted">
        Tables tenues cette saison (matchs passés). Merci à toutes et tous !
      </AppText>
      {query.isPending ? <CardSkeletons count={2} /> : null}
      {query.error ? <ErrorState message={humanMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {board && board.entries.length === 0 ? <EmptyState icon="clipboard-outline" title="Pas encore de table tenue cette saison" message="Le classement apparaîtra dès les premières tables de marque passées." /> : null}
      {board && board.entries.length ? (
        <>
          <View style={styles.podiumCard}>
            <View style={[styles.glow, { backgroundColor: accent.accent }]} />
            <View style={styles.total}>
              <Ionicons name="trophy" size={15} color="rgba(255,255,255,0.75)" />
              <AppText variant="eyebrow" color="rgba(255,255,255,0.75)">
                {board.totalDone} table{board.totalDone > 1 ? "s" : ""} tenue{board.totalDone > 1 ? "s" : ""} cette saison
              </AppText>
            </View>
            <View style={styles.podium}>
              {order.map((e) => (e ? <PodiumSpot key={e.licencie.id} entry={e} first={e === podium[0]} onPress={open(e)} /> : null))}
            </View>
          </View>
          {board.entries.length > 3 ? (
            <View style={styles.list}>
              {board.entries.slice(3).map((e, i) => (
                <Row key={e.licencie.id} entry={e} first={i === 0} onPress={open(e)} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function PodiumSpot({ entry, first, onPress }: { entry: Entry; first: boolean; onPress: () => void }) {
  const medal = MEDAL[entry.rank] ?? MEDAL[3];
  const size = first ? 96 : 72;
  const photo: ReactNode = entry.licencie.photoUrl ? (
    <Image source={{ uri: entry.licencie.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />
  ) : (
    <View style={[styles.mono, { width: size, height: size, borderRadius: size / 2 }]}>
      <AppText variant="title" color="rgba(255,255,255,0.75)">
        {initials(entry.licencie.firstName, entry.licencie.lastName)}
      </AppText>
    </View>
  );
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${entry.rank}, ${entry.licencie.firstName} ${entry.licencie.lastName}, ${entry.done} tables`} onPress={onPress} style={styles.spot}>
      <View style={[styles.ring, { borderColor: medal.ring, borderRadius: (size + 10) / 2 }]}>{photo}</View>
      <View style={[styles.rank, { backgroundColor: medal.badge }]}>
        <AppText variant="meta" color={medal.ink} style={styles.bold}>
          {entry.rank}
        </AppText>
      </View>
      <AppText variant="meta" color="rgba(255,255,255,0.8)" numberOfLines={1}>
        {entry.licencie.firstName}
      </AppText>
      <AppText variant={first ? "bodyStrong" : "meta"} color="#FFFFFF" numberOfLines={1} style={styles.upper}>
        {entry.licencie.lastName}
      </AppText>
      <View style={styles.count}>
        <AppText variant={first ? "headline" : "bodyStrong"} color="#FFFFFF">
          {entry.done}
          <AppText variant="meta" color="rgba(255,255,255,0.7)">
            {` table${entry.done > 1 ? "s" : ""}`}
          </AppText>
        </AppText>
      </View>
    </Pressable>
  );
}

function Row({ entry, first, onPress }: { entry: Entry; first: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.sep, pressed && styles.pressed]}>
      <AppText variant="bodyStrong" tone="muted" style={styles.rowRank}>
        {entry.rank}
      </AppText>
      <Avatar firstName={entry.licencie.firstName} lastName={entry.licencie.lastName} photoUrl={entry.licencie.photoUrl} size={40} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {entry.licencie.firstName} {entry.licencie.lastName}
        </AppText>
        <AppText variant="meta" tone="muted" numberOfLines={1}>
          {entry.byRole.map((r) => `${TABLE_ROLES.find((x) => x.role === r.role)?.label ?? r.role} ×${r.count}`).join(" · ")}
          {entry.upcoming > 0 ? ` · ${entry.upcoming} à venir` : ""}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="numeric">{entry.done}</AppText>
        <AppText variant="meta" tone="muted">
          table{entry.done > 1 ? "s" : ""}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  podiumCard: { backgroundColor: "#141414", borderRadius: radius.xl, overflow: "hidden", paddingTop: spacing.xl, paddingBottom: spacing.xl, paddingHorizontal: spacing.sm, ...shadows.raised },
  glow: { position: "absolute", width: 360, height: 260, borderRadius: 180, top: -170, alignSelf: "center", opacity: 0.5 },
  total: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, marginBottom: spacing.xl },
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  spot: { flex: 1, alignItems: "center", gap: 2 },
  ring: { borderWidth: 4, padding: 1 },
  mono: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: -14, marginBottom: spacing.xs },
  bold: { fontWeight: "800" },
  upper: { textTransform: "uppercase", fontWeight: "700" },
  count: { marginTop: spacing.xs, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.1)" },
  list: { borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden", ...shadows.card },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  rowRank: { width: 26, textAlign: "center" },
  flex: { flex: 1 },
  right: { alignItems: "flex-end" },
});
