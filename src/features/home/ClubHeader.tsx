import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { AppText, Button, ListRow, Sheet } from "@/components/ui";
import { colors, spacing } from "@/design";
import { ClubBadge } from "@/features/onboarding/ClubBadge";
import { AccountChip } from "./AccountChip";

/**
 * En-tête de l'espace du club, comme celui de /public sur le web : logo et
 * nom du club (toucher pour changer de club), identité reconnue à droite,
 * puis le titre de l'écran.
 */
export function ClubHeader({ title }: { title?: string }) {
  const { club, chooseClub } = useCurrentClubState();
  const { state } = useSession();
  const [open, setOpen] = useState(false);
  const known = Object.values(state.clubs);
  return (
    <View style={styles.box}>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${club?.name ?? ""}. Changer de club`} onPress={() => setOpen(true)} style={({ pressed }) => [styles.club, pressed && styles.pressed]} hitSlop={6}>
          {club ? <ClubBadge name={club.name} logoUrl={club.logoUrl} accentColor={club.accentColor} size={28} /> : null}
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.clubName}>
            {club?.name ?? ""}
          </AppText>
          <Ionicons name="chevron-down" size={14} color={colors.subtle} />
        </Pressable>
        <AccountChip />
      </View>
      {title ? (
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      <Sheet visible={open} title="Changer de club" onClose={() => setOpen(false)}>
        {known.map((c) => (
          <ListRow
            key={c.clubSlug}
            title={c.clubName}
            subtitle={c.people.map((p) => p.firstName).join(", ")}
            trailing={c.clubSlug === club?.slug ? <Ionicons name="checkmark" size={20} color={colors.success} /> : undefined}
            onPress={() => {
              chooseClub({ slug: c.clubSlug, name: c.clubName, accentColor: c.accentColor, timezone: c.timezone });
              setOpen(false);
            }}
          />
        ))}
        <Button
          label="Choisir un autre club"
          variant="secondary"
          onPress={() => {
            setOpen(false);
            router.push("/bienvenue");
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, paddingTop: spacing.xs },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 },
  club: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44 },
  clubName: { flexShrink: 1 },
  pressed: { opacity: 0.7 },
});
