import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Button, ListRow, Sheet } from "@/components/ui";
import { colors, spacing } from "@/design";

/** En-tête : club actif (sélecteur s'il y en a plusieurs) + titre de l'écran. */
export function ClubHeader({ title }: { title: string }) {
  const { state, club, setActiveClub } = useSession();
  const [open, setOpen] = useState(false);
  const clubs = Object.values(state.clubs);
  return (
    <View style={styles.box}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Club actif : ${club?.clubName ?? ""}. Changer de club`} onPress={() => setOpen(true)} style={styles.club} hitSlop={8}>
        <AppText variant="eyebrow" tone="subtle" numberOfLines={1}>
          {club?.clubName ?? ""}
        </AppText>
        <Ionicons name="chevron-down" size={14} color={colors.subtle} />
      </Pressable>
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
      <Sheet visible={open} title="Mes clubs" onClose={() => setOpen(false)}>
        {clubs.map((c) => (
          <ListRow
            key={c.clubSlug}
            title={c.clubName}
            subtitle={c.people.map((p) => p.firstName).join(", ")}
            trailing={c.clubSlug === club?.clubSlug ? <Ionicons name="checkmark" size={20} color={colors.success} /> : undefined}
            onPress={() => {
              void setActiveClub(c.clubSlug);
              setOpen(false);
            }}
          />
        ))}
        <Button
          label="Ajouter un club"
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
  box: { gap: spacing.xs, paddingTop: spacing.sm },
  club: { flexDirection: "row", alignItems: "center", gap: spacing.xs, alignSelf: "flex-start", minHeight: 28 },
});
