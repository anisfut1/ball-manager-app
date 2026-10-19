import { useEffect, useState, type ReactNode } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, Button } from "@/components/ui";
import { colors, spacing } from "@/design";
import { useReducedMotion } from "./useReducedMotion";

/** Pastille de confirmation : apparition douce (instantanée si animations réduites). */
function StatusMark({ tone, icon }: { tone: "success" | "info"; icon: keyof typeof Ionicons.glyphMap }) {
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(reduced ? 1 : 0.6));
  useEffect(() => {
    if (reduced) return;
    Animated.timing(scale, { toValue: 1, duration: 420, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start();
  }, [reduced, scale]);
  const fg = tone === "success" ? colors.success : colors.info;
  return (
    <Animated.View style={[styles.mark, { backgroundColor: tone === "success" ? colors.successSoft : colors.infoSoft, transform: [{ scale }] }]}>
      <Ionicons name={icon} size={28} color={fg} />
    </Animated.View>
  );
}

function Panel({ mark, title, children, backLabel, onBack }: { mark: ReactNode; title: string; children: ReactNode; backLabel: string; onBack: () => void }) {
  return (
    <View style={styles.panel} accessibilityLiveRegion="polite">
      {mark}
      <AppText variant="title" accessibilityRole="header" style={styles.center}>
        {title}
      </AppText>
      {children}
      <Button label={backLabel} variant="ghost" onPress={onBack} />
    </View>
  );
}

/** Lien envoyé : adresse masquée par le serveur, jamais l'adresse complète. */
export function LicensedLinkSent({ firstName, maskedEmail, onBack }: { firstName: string; maskedEmail: string; onBack: () => void }) {
  return (
    <Panel mark={<StatusMark tone="success" icon="checkmark" />} title={`C'est envoyé, ${firstName} !`} backLabel="Ce n'est pas moi" onBack={onBack}>
      <AppText variant="callout" tone="muted" style={styles.center}>
        Ton lien sécurisé vient de partir à <AppText variant="callout" style={styles.strong}>{maskedEmail}</AppText>, l&apos;adresse enregistrée auprès du club. Ouvre-le sur ce téléphone : Ball Manager s&apos;ouvrira directement, connecté.
      </AppText>
      <View style={styles.tip}>
        <Ionicons name="mail-unread-outline" size={16} color={colors.subtle} />
        <AppText variant="meta" tone="muted" style={styles.flex}>
          Rien reçu d&apos;ici quelques minutes ? Regarde dans tes indésirables (spams).
        </AppText>
      </View>
    </Panel>
  );
}

export function LicensedLinkPending({ firstName, onBack }: { firstName: string; onBack: () => void }) {
  return (
    <Panel mark={<StatusMark tone="info" icon="hourglass-outline" />} title="Demande transmise" backLabel="Revenir à la recherche" onBack={onBack}>
      <AppText variant="callout" tone="muted" style={styles.center}>
        Le club n&apos;a pas encore d&apos;adresse pour {firstName} : un responsable valide la demande, puis le lien arrive par email.
      </AppText>
    </Panel>
  );
}

export function LicensedRequestSent({ onBack }: { onBack: () => void }) {
  return (
    <Panel mark={<StatusMark tone="success" icon="paper-plane-outline" />} title="Demande envoyée au club" backLabel="Revenir à la recherche" onBack={onBack}>
      <AppText variant="callout" tone="muted" style={styles.center}>
        Un responsable vérifie ta fiche et te répond par email.
      </AppText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  mark: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  strong: { fontWeight: "600", color: colors.foreground },
  tip: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", alignSelf: "stretch", padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface },
  flex: { flex: 1 },
});
