import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, CardSkeletons, EmptyState, ErrorState, Screen } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubHeader } from "@/features/home/ClubHeader";
import { TeamPage } from "@/features/team/TeamPage";
import { collectTeams } from "@/features/team-life/web-labels";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { LicensedGateScreen } from "@/features/licensed-access/LicensedGateScreen";

/** Réservé aux licenciés : la porte d'accès tant que personne n'est reconnu pour ce club (comme le web). */
export default function TeamsTab() {
  const { session, switching } = useCurrentClubState();
  return session ? <MemberTeams /> : switching ? null : <LicensedGateScreen module="team" />;
}

/**
 * Onglet « Équipe » — copie du PublicTeamsApp du web : les équipes des
 * personnes de l'appareil, équipes coachées d'abord ; une seule équipe →
 * sa page directement.
 */
function MemberTeams() {
  const club = useActiveClub();
  const accent = useClubAccent();
  const queryClient = useQueryClient();
  const people = club.people.map((p) => p.licencieId);
  const homes = useQueries({ queries: people.map((id) => ({ queryKey: queryKeys.home(club.clubSlug, id), queryFn: () => clubSpaceApi.home(club.clubSlug, id) })) });
  const pending = homes.some((h) => h.isPending);
  const homeData = homes.map((h) => h.data);
  const loaded = useMemo(() => homeData.flatMap((d) => (d ? [d] : [])), [homeData]);
  const failed = homes.find((h) => h.error)?.error ?? null;
  const teams = useMemo(() => collectTeams(loaded), [loaded]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["home", club.clubSlug] });
    void queryClient.invalidateQueries({ queryKey: ["team-overview", club.clubSlug] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
  };

  return (
    <Screen refreshing={false} onRefresh={refresh}>
      {teams.length === 1 && !pending ? (
        <TeamPage teamId={teams[0]!.id} />
      ) : (
        <>
          <ClubHeader title="Mes équipes" />
          <AppText variant="callout" tone="muted">
            Prochain match, entraînements et effectif.
          </AppText>
          {pending ? <CardSkeletons count={3} /> : null}
          {!pending && failed && !loaded.length ? <ErrorState title="Équipes indisponibles" message={humanMessage(failed)} onRetry={refresh} /> : null}
          {!pending && loaded.length > 0 && teams.length === 0 ? <EmptyState icon="people-outline" title="Aucune équipe" message="Aucune équipe n'est encore associée à ton profil. Préviens le club." /> : null}
          <View style={styles.list}>
            {teams.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityLabel={t.name}
                onPress={() => router.push(`/c/${club.clubSlug}/equipes/${t.id}`)}
                style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              >
                <Ionicons name={t.coach ? "megaphone-outline" : "shirt-outline"} size={18} color={t.coach ? colors.info : accent.text} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {t.name}
                  </AppText>
                  <AppText variant="meta" tone="muted" numberOfLines={1}>
                    {t.coach ? "Tu coaches cette équipe" : t.who.join(", ")}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
              </Pressable>
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  flex: { flex: 1, gap: 2 },
});
