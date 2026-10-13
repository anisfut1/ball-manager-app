import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, Button, CardSkeletons, EmptyState, ErrorState } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { currentSeasonStart } from "@/lib/season";
import { formatWeekendLabel } from "@/lib/weekend";
import { homeVenueColumns } from "./home-venues";
import { MatchCard } from "./MatchCard";
import { SIDE_OPTIONS, WHEN_OPTIONS, applyMatchFilters, defaultWeekend, groupMatchesByWeekend, weekendOptions, type MatchFiltersState, type WeekendGroup } from "./match-filters";
import { useClubInfo } from "./useClubInfo";

const DEFAULT: MatchFiltersState = { when: "weekend", side: "all", team: null, weekend: null };

/**
 * Matchs de la saison, comme la page Matchs du web (MatchesView) : filtres
 * Journée / À venir / Passés, lieu, équipe ; sélecteur de journée ; par
 * week-end, matchs à domicile par salle puis à l'extérieur.
 */
export function MatchesView() {
  const club = useClubInfo();
  const [filters, setFilters] = useState<MatchFiltersState>(DEFAULT);
  const data = useQuery({
    queryKey: queryKeys.season(club.slug),
    queryFn: async () => {
      const [teams, matches] = await Promise.all([teamLifeApi.teams(club.slug), clubSpaceApi.allMatches(club.slug, { from: currentSeasonStart().toISOString() })]);
      return { teams: teams.teams, matches };
    },
  });
  const teams = useMemo(() => data.data?.teams ?? [], [data.data]);
  const all = useMemo(() => data.data?.matches ?? [], [data.data]);
  const matches = useMemo(() => applyMatchFilters(all, teams, filters), [all, teams, filters]);
  const set = (changes: Partial<MatchFiltersState>) => setFilters((f) => ({ ...f, ...changes }));
  const isDefault = filters.when === "weekend" && filters.side === "all" && !filters.team && !filters.weekend;

  const current = defaultWeekend();
  const selected = filters.weekend ?? current;
  const journees = useMemo(() => {
    const list = weekendOptions(all, teams, filters);
    return list.some((o) => o.saturday === selected) ? list : [...list, { saturday: selected, label: formatWeekendLabel(selected), count: 0 }].sort((a, b) => a.saturday.localeCompare(b.saturday));
  }, [all, teams, filters, selected]);
  const index = journees.findIndex((o) => o.saturday === selected);
  const prev = journees.slice(0, index).reverse().find((o) => o.count > 0) ?? null;
  const next = journees.slice(index + 1).find((o) => o.count > 0) ?? null;
  const goTo = (saturday: string) => set({ when: "weekend", weekend: saturday === current ? null : saturday });
  const periodLabel = WHEN_OPTIONS.find((o) => o.value === filters.when)?.label.toLowerCase() ?? "";

  if (data.isPending) return <CardSkeletons count={3} />;
  if (data.error) return <ErrorState message={humanMessage(data.error)} onRetry={() => void data.refetch()} />;

  return (
    <>
      <ChipRow options={WHEN_OPTIONS.map((o) => ({ key: o.value, label: o.label }))} active={filters.when} onSelect={(v) => set({ when: v as MatchFiltersState["when"], weekend: null })} />
      <ChipRow options={SIDE_OPTIONS.map((o) => ({ key: o.value, label: o.label }))} active={filters.side} onSelect={(v) => set({ side: v as MatchFiltersState["side"] })} />
      <ChipRow options={[{ key: "", label: "Toutes les équipes" }, ...teams.filter((t) => t.active).map((t) => ({ key: t.id, label: t.name }))]} active={filters.team ?? ""} onSelect={(v) => set({ team: v || null })} />
      {!isDefault ? <Button label="Réinitialiser les filtres" variant="ghost" onPress={() => setFilters(DEFAULT)} /> : null}

      {filters.when === "weekend" ? (
        <View style={styles.journee}>
          <NavButton icon="chevron-back" label="Journée précédente" disabled={!prev} onPress={() => prev && goTo(prev.saturday)} />
          <View style={styles.journeeLabel}>
            <AppText variant="headline" style={styles.center}>
              {formatWeekendLabel(selected)}
            </AppText>
            {selected !== current ? (
              <Pressable onPress={() => goTo(current)}>
                <AppText variant="meta" tone="muted" style={styles.center}>
                  Revenir à cette journée
                </AppText>
              </Pressable>
            ) : null}
          </View>
          <NavButton icon="chevron-forward" label="Journée suivante" disabled={!next} onPress={() => next && goTo(next.saturday)} />
        </View>
      ) : (
        <AppText variant="meta" tone="muted">
          {matches.length} match{matches.length > 1 ? "s" : ""} · {periodLabel}
        </AppText>
      )}

      {matches.length === 0 ? (
        <>
          <EmptyState icon="calendar-outline" title={filters.when === "weekend" ? "Aucun match cette journée" : "Aucun match ne correspond"} message="Élargissez la période ou retirez un filtre pour voir d'autres rencontres de la saison." />
          {filters.when === "weekend" && next ? <Button label="Voir la journée suivante" variant="secondary" onPress={() => goTo(next.saturday)} /> : null}
        </>
      ) : (
        groupMatchesByWeekend(matches).map((g) => <WeekendSection key={g.saturday} group={g} showHeader={filters.when !== "weekend"} club={club} />)
      )}
    </>
  );
}

function WeekendSection({ group, showHeader, club }: { group: WeekendGroup; showHeader: boolean; club: ReturnType<typeof useClubInfo> }) {
  const accent = useClubAccent();
  const home = group.matches.filter((m) => m.isHome === true);
  const other = group.matches.filter((m) => m.isHome !== true);
  const open = (id: string) => router.push(`/c/${club.slug}/matchs/${id}`);
  return (
    <View style={styles.section}>
      {showHeader ? (
        <View style={styles.weekHeader}>
          <Ionicons name="calendar-outline" size={16} color={accent.text} />
          <AppText variant="headline" style={styles.flex}>
            {group.label}
          </AppText>
          <AppText variant="meta" tone="muted">
            {group.matches.length} match{group.matches.length > 1 ? "s" : ""}
            {home.length ? ` · ${home.length} à domicile` : ""}
          </AppText>
        </View>
      ) : null}
      {home.length ? (
        <>
          <SubHeader icon="home-outline" title="À domicile" />
          {homeVenueColumns(home).map((col) => (
            <View key={col.key} style={styles.venue}>
              <View style={styles.venueHead}>
                <Ionicons name="location-outline" size={15} color={accent.text} />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {col.label}
                </AppText>
                <AppText variant="meta" tone="muted">
                  {col.matches.length} match{col.matches.length > 1 ? "s" : ""}
                </AppText>
              </View>
              {col.matches.map((m) => (
                <MatchCard key={m.id} match={m} club={club} onPress={() => open(m.id)} />
              ))}
            </View>
          ))}
        </>
      ) : null}
      {other.length ? (
        <>
          <SubHeader icon="car-outline" title="À l'extérieur" />
          {other.map((m) => (
            <MatchCard key={m.id} match={m} club={club} onPress={() => open(m.id)} />
          ))}
        </>
      ) : null}
    </View>
  );
}

function SubHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sub}>
      <Ionicons name={icon} size={16} color={colors.muted} />
      <AppText variant="eyebrow" tone="subtle">
        {title}
      </AppText>
    </View>
  );
}

function ChipRow({ options, active, onSelect }: { options: { key: string; label: string }[]; active: string; onSelect: (key: string) => void }) {
  const accent = useClubAccent();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips}>
      {options.map((o) => {
        const on = o.key === active;
        return (
          <Pressable key={o.key || "all"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onSelect(o.key)} style={[styles.chip, on && { backgroundColor: accent.soft, borderColor: accent.accent }]}>
            <AppText variant="callout" color={on ? accent.text : colors.muted} style={styles.chipText}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function NavButton({ icon, label, disabled, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.nav, disabled && styles.disabled]}>
      <Ionicons name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipBar: { marginHorizontal: -spacing.gutter, flexGrow: 0 },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.gutter },
  chip: { height: 36, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  chipText: { fontWeight: "600" },
  journee: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  journeeLabel: { flex: 1, gap: 2 },
  center: { textAlign: "center" },
  nav: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  disabled: { opacity: 0.35 },
  section: { gap: spacing.md },
  weekHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  flex: { flex: 1 },
  sub: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.sm },
  venue: { gap: spacing.sm },
  venueHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
