import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui";
import { colors, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { Floating } from "./LicensedBackdrop";
import { LicensedSearchCard } from "./LicensedSearchCard";
import { licensedAccessModules, type LicensedAccessModuleId } from "./modules";

const STEPS = ["Retrouve ton nom", "Reçois ton lien sécurisé", "Accède à ton espace"];

/**
 * Porte d'entrée commune des espaces réservés aux licenciés (même
 * architecture visuelle que ball-manager-web) : club + badge « Accès
 * réservé », bulle du module, titre, puis directement la recherche — les
 * étapes passent sous la carte. Multi-club : nom, logo et couleur viennent
 * du club (accent rendu accessible par `deriveClubAccent`).
 */
export function LicensedAccessGate({ module, clubSlug, clubName, logoUrl, accentColor, footer }: { module: LicensedAccessModuleId; clubSlug: string; clubName: string; logoUrl: string | null; accentColor?: string | null; footer?: ReactNode }) {
  const accent = useClubAccent();
  const config = licensedAccessModules[module];
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={styles.clubRow}>
          <ClubBadge name={clubName} logoUrl={logoUrl} accentColor={accentColor} size={28} />
          <AppText variant="callout" style={[styles.strong, styles.flex]} numberOfLines={1}>
            {clubName}
          </AppText>
        </View>
        <View style={[styles.badge, { borderColor: `${accent.accent}47`, backgroundColor: accent.soft }]}>
          <Ionicons name="lock-closed" size={11} color={accent.text} />
          <AppText variant="eyebrow" color={accent.text} style={styles.badgeText}>
            Accès réservé aux licenciés
          </AppText>
        </View>
        <View style={styles.titleRow}>
          <Floating amplitude={4} duration={3000}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.bubble, { borderColor: `${accent.accent}38`, boxShadow: `inset 0 1px 0 #FFFFFF, 0 12px 26px -12px ${accent.accent}73`, experimental_backgroundImage: `linear-gradient(160deg, #FFFFFF 0%, ${accent.soft} 100%)` }]}>
              <Ionicons name={config.icon} size={24} color={accent.text} />
            </View>
          </Floating>
          <View style={styles.flex}>
            <AppText variant="display" accessibilityRole="header">
              {config.title}
            </AppText>
            {config.audience ? (
              <AppText variant="meta" tone="muted">
                {config.audience}
              </AppText>
            ) : null}
          </View>
        </View>
        <AppText variant="callout" tone="muted">
          {config.description}
        </AppText>
      </View>

      <LicensedSearchCard clubSlug={clubSlug} />

      <View style={styles.remembered}>
        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
        <AppText variant="meta" tone="muted" style={styles.flexShrink}>
          Connexion mémorisée ensuite sur ce téléphone, sans mot de passe.
        </AppText>
      </View>

      <View style={styles.steps} accessibilityLabel="Comment ça marche">
        {STEPS.map((label, index) => (
          <View key={label} style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: accent.soft }]}>
              <AppText variant="meta" color={accent.text} style={styles.strong}>
                {index + 1}
              </AppText>
            </View>
            <AppText variant="meta" style={styles.stepLabel}>
              {label}
            </AppText>
          </View>
        ))}
      </View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  hero: { gap: spacing.md, paddingTop: spacing.sm },
  clubRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 11, letterSpacing: 1.1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bubble: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: 1, backgroundColor: colors.surfaceRaised },
  remembered: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingHorizontal: spacing.md },
  steps: { flexDirection: "row", gap: spacing.sm },
  step: { flex: 1, gap: spacing.xs, padding: spacing.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.6)" },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontWeight: "500", color: colors.foreground },
  strong: { fontWeight: "600" },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, textAlign: "center" },
});
