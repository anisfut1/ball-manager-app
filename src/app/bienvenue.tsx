import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { AppText, CardSkeletons, ErrorState, Screen, TextField } from "@/components/ui";
import { AccountDeletedBanner } from "@/features/account/AccountDeletedBanner";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { colors, radius, shadows, spacing } from "@/design";
import { FALLBACK_ACCENT } from "@/design/accent";

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "megaphone-outline", label: "Convocations" },
  { icon: "basketball-outline", label: "Matchs" },
  { icon: "fitness-outline", label: "Entraînements" },
  { icon: "clipboard-outline", label: "Tables" },
];

/** Au-delà, la liste des clubs se filtre par recherche. */
const SEARCH_FROM = 7;

/** Bienvenue : une app pour tous les clubs Ball Manager. On choisit son club, puis on se retrouve par son nom. */
export default function WelcomeScreen() {
  const clubs = useQuery({ queryKey: queryKeys.clubs, queryFn: authApi.listClubs });
  const [q, setQ] = useState("");
  const all = useMemo(() => clubs.data?.clubs ?? [], [clubs.data]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((c) => !needle || c.name.toLowerCase().includes(needle));
  }, [all, q]);

  return (
    <Screen edges={[]} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.bubble, styles.bubbleA]} />
        <View style={[styles.bubble, styles.bubbleB]} />
        <SafeAreaView edges={["top"]}>
          <View style={styles.heroInner}>
            <Image source={require("../../assets/images/icon.png")} style={styles.logo} accessibilityIgnoresInvertColors />
            <AppText variant="display" color="#FFFFFF">
              Ball Manager
            </AppText>
            <AppText variant="callout" color="rgba(255,255,255,0.88)" style={styles.center}>
              Toute la vie de ton club de basket dans ta poche.
            </AppText>
            <View style={styles.features}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.feature}>
                  <Ionicons name={f.icon} size={15} color="#FFFFFF" />
                  <AppText variant="meta" color="#FFFFFF" style={styles.featureLabel}>
                    {f.label}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </SafeAreaView>
      </View>

      <View style={styles.section}>
        <AccountDeletedBanner />
        <AppText variant="title" accessibilityRole="header">
          Choisis ton club
        </AppText>
        {all.length >= SEARCH_FROM ? <TextField label="Rechercher un club" value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" placeholder="Nom ou ville" /> : null}
        {clubs.isPending ? <CardSkeletons count={2} /> : null}
        {clubs.error ? <ErrorState message={humanMessage(clubs.error)} onRetry={() => void clubs.refetch()} /> : null}
        {filtered.map((c) => (
          <Pressable
            key={c.slug}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            accessibilityHint="Se connecter à ce club"
            onPress={() => router.push(`/connexion/${c.slug}`)}
            style={({ pressed }) => [styles.clubCard, pressed && styles.pressed]}
          >
            <ClubBadge name={c.name} logoUrl={c.logoUrl} size={52} />
            <View style={styles.clubText}>
              <AppText variant="headline" numberOfLines={2}>
                {c.name}
              </AppText>
              <AppText variant="meta" tone="muted">
                Retrouve ton nom pour te connecter
              </AppText>
            </View>
            <View style={styles.go}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        ))}
        {clubs.data && !filtered.length ? (
          <AppText variant="callout" tone="muted">
            Aucun club ne correspond.
          </AppText>
        ) : null}
        <View style={styles.footer}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.subtle} />
          <AppText variant="meta" tone="subtle" style={styles.footerText}>
            Pas de compte ni de mot de passe : ton club t&apos;identifie, et seules tes informations s&apos;affichent.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0, paddingTop: 0, gap: 0 },
  hero: { backgroundColor: FALLBACK_ACCENT, borderBottomLeftRadius: radius.xl * 1.5, borderBottomRightRadius: radius.xl * 1.5, overflow: "hidden" },
  bubble: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.09)" },
  bubbleA: { width: 260, height: 260, top: -90, right: -80 },
  bubbleB: { width: 180, height: 180, bottom: -70, left: -50 },
  heroInner: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl, paddingBottom: spacing.xxxl },
  logo: { width: 76, height: 76, borderRadius: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" },
  center: { textAlign: "center" },
  features: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm, marginTop: spacing.sm },
  feature: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.16)" },
  featureLabel: { fontWeight: "600" },
  section: { paddingHorizontal: spacing.gutter, paddingTop: spacing.xxl, gap: spacing.md },
  clubCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadows.card,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  clubText: { flex: 1, gap: 2 },
  go: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: FALLBACK_ACCENT },
  footer: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start", marginTop: spacing.sm },
  footerText: { flex: 1 },
});
