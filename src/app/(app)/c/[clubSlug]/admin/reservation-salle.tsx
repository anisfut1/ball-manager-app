import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Button, Card, CardSkeletons, ErrorState, SegmentedControl } from "@/components/ui";
import { env } from "@/config/env";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { AdminScreen } from "@/features/admin/AdminScreen";
import { buildBookingGrid, monthKey, monthLabel, monthRange, parseBookingMonth, shiftMonth, shortVenue } from "@/features/admin/venue-booking";

/** Mois de la saison (septembre → juin) autour du mois affiché. */
function seasonMonths(year: number, month: number) {
  const startYear = month >= 7 ? year : year - 1;
  return Array.from({ length: 10 }, (_, i) => shiftMonth(startYear, 9, i));
}

/**
 * Réservation salle (admins) : le planning du mois, jour par jour, avec
 * l'heure de chaque équipe — le même calcul que la page du site. L'export PDF
 * paysage se fait sur le site (bouton « PDF »).
 */
export default function AdminVenueBookingScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const accent = useClubAccent();
  const [shown, setShown] = useState(() => parseBookingMonth(undefined, club.timezone, new Date()));
  const [scope, setScope] = useState<"home" | "all">("home");
  const key = monthKey(shown.year, shown.month);

  const data = useQuery({
    queryKey: queryKeys.adminBooking(slug, key),
    queryFn: async () => {
      const [teams, matches] = await Promise.all([adminApi.teams(slug), adminApi.matches(slug, monthRange(shown.year, shown.month))]);
      return { teams, matches };
    },
  });
  const grid = data.data
    ? buildBookingGrid({ matches: data.data.matches, teams: data.data.teams.filter((t) => t.active).map((t) => t.name), year: shown.year, month: shown.month, timeZone: club.timezone, homeOnly: scope === "home" })
    : null;
  const mainVenue = grid?.mainVenue ? shortVenue(grid.mainVenue) : null;

  return (
    <AdminScreen title="Réservation salle" onRefresh={() => void data.refetch()}>
      {() => (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months}>
            {seasonMonths(shown.year, shown.month).map((m) => {
              const active = m.year === shown.year && m.month === shown.month;
              return (
                <Pressable
                  key={monthKey(m.year, m.month)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setShown(m)}
                  style={[styles.month, active && { backgroundColor: accent.accent }]}
                >
                  <AppText variant="callout" color={active ? accent.ink : colors.muted} style={styles.monthText}>
                    {monthLabel(m.year, m.month).split(" ")[0]}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <SegmentedControl
            options={[
              { value: "home", label: "À domicile" },
              { value: "all", label: "Tous les matchs" },
            ]}
            value={scope}
            onChange={setScope}
          />

          {data.isPending ? (
            <CardSkeletons count={3} />
          ) : data.isError ? (
            <ErrorState message={humanMessage(data.error)} onRetry={() => void data.refetch()} />
          ) : grid ? (
            <>
              <AppText variant="meta" tone="muted">
                {`${grid.monthLabel} · ${grid.matchCount} match${grid.matchCount > 1 ? "s" : ""}${mainVenue ? ` · gymnase principal : ${mainVenue}` : ""}`}
              </AppText>
              {grid.days.map((day) => {
                const entries = grid.teams.flatMap((team) => (day.cells[team] ?? []).map((cell) => ({ team, cell })));
                return (
                  <View key={day.key} style={day.startsWeek ? styles.newWeek : undefined}>
                    <Card style={styles.day}>
                      <AppText variant="bodyStrong">{day.label}</AppText>
                      {entries.length === 0 ? (
                        <AppText variant="meta" tone="subtle">
                          Aucun match
                        </AppText>
                      ) : (
                        entries.map(({ team, cell }) => (
                          <View key={cell.matchId} style={styles.row}>
                            <AppText variant="bodyStrong" style={styles.time}>
                              {cell.time}
                            </AppText>
                            <View style={styles.flex}>
                              <AppText variant="callout">{team}</AppText>
                              <AppText variant="meta" tone="muted">
                                {[cell.opponent ? `vs ${cell.opponent}` : null, cell.venue].filter(Boolean).join(" · ") || " "}
                              </AppText>
                            </View>
                          </View>
                        ))
                      )}
                    </Card>
                  </View>
                );
              })}
            </>
          ) : null}

          <Button
            label="Exporter en PDF (sur le site)"
            variant="secondary"
            icon={<Ionicons name="document-outline" size={18} color={colors.foreground} />}
            onPress={() => void WebBrowser.openBrowserAsync(`${env.webUrl}/c/${slug}/matchs/reservation-salle?mois=${key}${scope === "all" ? "&lieu=tous" : ""}`)}
            fullWidth
          />
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  months: { gap: spacing.xs },
  month: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  monthText: { fontWeight: "600" },
  newWeek: { marginTop: spacing.sm },
  day: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  time: { width: 56, fontVariant: ["tabular-nums"] },
  flex: { flex: 1 },
});
