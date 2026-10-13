import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import type { MatchDetailsDto } from "@/api/endpoints/teamLife";
import { AppText, Avatar, initials } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { formatSecondsPlayed, personName } from "./labels";

type StatRow = MatchDetailsDto["stats"][number];

const displayName = (row: StatRow) => `${row.firstName?.trim() ?? ""} ${row.lastName?.trim() ?? ""}`.trim() || "Joueur·se";

/**
 * Stats d'une équipe, comme le web (PlayerStatCards) : totaux, top 3
 * marqueurs en cartes photo, puis toute l'équipe (meilleur marqueur
 * d'abord), et le tableau détaillé à déplier. « — » = donnée non lue avec
 * certitude, jamais une valeur nulle supposée.
 */
export function PlayerStatCards({ rows, accent, playerBase }: { rows: StatRow[]; accent: boolean; playerBase: string | null }) {
  const [table, setTable] = useState(false);
  const sorted = [...rows].sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || (b.secondsPlayed ?? 0) - (a.secondsPlayed ?? 0));
  const total = (pick: (r: StatRow) => number | null) => rows.reduce((sum, r) => sum + (pick(r) ?? 0), 0);
  const top = sorted.filter((r) => (r.points ?? 0) > 0).slice(0, 3);
  const open = (row: StatRow) => (playerBase && row.licencieId ? () => router.push(`${playerBase}/${row.licencieId}`) : undefined);

  return (
    <View style={styles.wrap}>
      <View style={styles.totals}>
        {[
          ["Points", total((r) => r.points)],
          ["Tirs à 3 pts", total((r) => r.threePointsMade)],
          ["Lancers francs", total((r) => r.freeThrowsMade)],
        ].map(([label, value]) => (
          <View key={String(label)} style={styles.total}>
            <AppText variant="numeric">{value}</AppText>
            <AppText variant="meta" tone="muted">
              {label}
            </AppText>
          </View>
        ))}
      </View>
      {top.length ? (
        <>
          <AppText variant="eyebrow" tone="subtle">
            Top 3 marqueurs
          </AppText>
          <View style={styles.tops}>
            {top.map((row, i) => (
              <Highlight key={row.participantId} label={`${i + 1}${i === 0 ? "er" : "e"} marqueur`} row={row} accent={accent} onPress={open(row)} />
            ))}
          </View>
        </>
      ) : null}
      <View style={styles.list}>
        {sorted.map((row, i) => (
          <PlayerRow key={row.participantId} row={row} first={i === 0} onPress={open(row)} />
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => setTable((v) => !v)} style={styles.toggle}>
        <Ionicons name={table ? "chevron-down" : "grid-outline"} size={14} color={colors.muted} />
        <AppText variant="meta" tone="muted">
          Tableau détaillé
        </AppText>
      </Pressable>
      {table ? <DetailTable rows={rows} /> : null}
    </View>
  );
}

function Highlight({ label, row, accent, onPress }: { label: string; row: StatRow; accent: boolean; onPress?: () => void }) {
  const clubAccent = useClubAccent();
  const name = displayName(row);
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} style={[styles.highlight, { backgroundColor: accent ? clubAccent.accent : "#3A3A3A" }]}>
      {row.photoUrl ? (
        <Image source={{ uri: row.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <AppText variant="display" color="rgba(255,255,255,0.35)" style={styles.monogram}>
          {initials(row.firstName ?? name, row.lastName)}
        </AppText>
      )}
      <View style={styles.shade} />
      <View style={styles.highlightText}>
        <AppText variant="meta" color="rgba(255,255,255,0.75)" style={styles.upper}>
          {label}
        </AppText>
        <AppText variant="bodyStrong" color="#FFFFFF">
          {row.points} pts
        </AppText>
        <AppText variant="meta" color="rgba(255,255,255,0.9)" numberOfLines={1}>
          #{row.jerseyNumber ?? "?"} {row.lastName ?? name}
        </AppText>
      </View>
    </Pressable>
  );
}

function PlayerRow({ row, first, onPress }: { row: StatRow; first: boolean; onPress?: () => void }) {
  const accent = useClubAccent();
  const name = displayName(row);
  return (
    <Pressable accessibilityRole={onPress ? "button" : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.sep, pressed && styles.pressed]}>
      <Avatar firstName={row.firstName ?? name} lastName={row.lastName} photoUrl={row.photoUrl} size={40} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          <AppText variant="body" tone="muted">
            #{row.jerseyNumber ?? "?"}{" "}
          </AppText>
          {name}
        </AppText>
        <AppText variant="meta" tone="muted" numberOfLines={1}>
          {formatSecondsPlayed(row.secondsPlayed)} · {row.threePointsMade ?? "—"}×3 pts · {row.twoPointsInteriorMade ?? "—"} int · {row.twoPointsExteriorMade ?? "—"} ext · {row.freeThrowsMade ?? "—"} LF · {row.foulsCommitted ?? "—"} f.
        </AppText>
      </View>
      <View style={styles.pts}>
        <AppText variant="numeric">{row.points ?? "—"}</AppText>
        <AppText variant="meta" tone="muted">
          pts
        </AppText>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={accent.text} /> : null}
    </Pressable>
  );
}

const COLUMNS: { label: string; pick: (r: StatRow) => string }[] = [
  { label: "Temps", pick: (r) => formatSecondsPlayed(r.secondsPlayed) },
  { label: "Pts", pick: (r) => String(r.points ?? "—") },
  { label: "3pts", pick: (r) => String(r.threePointsMade ?? "—") },
  { label: "2int", pick: (r) => String(r.twoPointsInteriorMade ?? "—") },
  { label: "2ext", pick: (r) => String(r.twoPointsExteriorMade ?? "—") },
  { label: "LF", pick: (r) => String(r.freeThrowsMade ?? "—") },
  { label: "Fautes", pick: (r) => String(r.foulsCommitted ?? "—") },
];

function DetailTable({ rows }: { rows: StatRow[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.table}>
      <View>
        <View style={[styles.tr, styles.th]}>
          <AppText variant="eyebrow" tone="subtle" style={styles.nameCol}>
            Joueur
          </AppText>
          {COLUMNS.map((c) => (
            <AppText key={c.label} variant="eyebrow" tone="subtle" style={styles.numCol}>
              {c.label}
            </AppText>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.participantId} style={[styles.tr, styles.sep]}>
            <AppText variant="callout" numberOfLines={1} style={styles.nameCol}>
              {r.jerseyNumber ?? "?"} · {personName(r)}
            </AppText>
            {COLUMNS.map((c) => (
              <AppText key={c.label} variant="callout" style={[styles.numCol, c.label === "Pts" && styles.bold]}>
                {c.pick(r)}
              </AppText>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  totals: { flexDirection: "row", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.card },
  total: { flex: 1, alignItems: "center" },
  tops: { flexDirection: "row", gap: spacing.sm },
  highlight: { flex: 1, aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  monogram: { position: "absolute", top: "18%", alignSelf: "center" },
  shade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  highlightText: { padding: spacing.sm, gap: 1 },
  upper: { textTransform: "uppercase", fontSize: 10 },
  list: { borderRadius: radius.lg, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: "hidden", ...shadows.card },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minHeight: 64 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.surfaceMuted },
  flex: { flex: 1 },
  pts: { alignItems: "flex-end" },
  toggle: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", paddingVertical: spacing.xs },
  table: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  th: { backgroundColor: colors.surface },
  nameCol: { width: 170 },
  numCol: { width: 54, textAlign: "right", fontVariant: ["tabular-nums"] },
  bold: { fontWeight: "700" },
});
