import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { AppText, Avatar, ListRow, Sheet } from "@/components/ui";
import { colors, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { useRoles } from "@/features/roles/useRoles";

/**
 * Identité reconnue sur cet appareil pour le club affiché, à droite de
 * l'en-tête (comme PublicAccountChip sur le web). Rien tant que personne
 * n'est reconnu : l'identification se fait depuis les onglets qui l'exigent.
 */
export function AccountChip() {
  const { session } = useCurrentClubState();
  if (!session) return null;
  return <SignedInChip />;
}

function SignedInChip() {
  const { person, logout } = useSession();
  const { club, session } = useCurrentClubState();
  const { roles } = useRoles();
  const accent = useClubAccent();
  const [open, setOpen] = useState(false);
  if (!person || !session || !club) return null;
  const name = `${person.firstName} ${person.lastName}`;
  const role = roles.isClubAdmin ? "Administrateur du club" : roles.isCoach ? "Coach · reconnu·e via ton lien personnel" : "Reconnu·e via ton lien personnel";
  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };
  const forget = () =>
    Alert.alert("Oublier cet appareil ?", `Tu ne seras plus reconnu·e sur ${club.name} et tu ne recevras plus ses notifications ici. Les pages publiques restent accessibles.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Oublier",
        style: "destructive",
        onPress: () => {
          setOpen(false);
          void logout(session.clubSlug);
        },
      },
    ]);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Connecté·e en tant que ${name}`} onPress={() => setOpen(true)} hitSlop={6} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
        <Avatar firstName={person.firstName} lastName={person.lastName} size={34} />
      </Pressable>
      <Sheet visible={open} title="Mon espace" onClose={() => setOpen(false)}>
        <View style={styles.who}>
          <Avatar firstName={person.firstName} lastName={person.lastName} size={44} />
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={1}>
              {name}
            </AppText>
            <View style={styles.role}>
              {roles.isClubAdmin ? <Ionicons name="shield-checkmark-outline" size={14} color={accent.text} /> : null}
              <AppText variant="meta" tone="muted">
                {role}
              </AppText>
            </View>
          </View>
        </View>
        <ListRow title="Mon planning" subtitle="Matchs et entraînements, semaine par semaine" leading={<Ionicons name="calendar-outline" size={22} color={colors.muted} />} onPress={() => go("/planning")} />
        {roles.isCoach || roles.isClubAdmin ? <ListRow title="Entraînements" subtitle="Créneaux, séances et présences" leading={<Ionicons name="barbell-outline" size={22} color={colors.muted} />} onPress={() => go(`/c/${session.clubSlug}/entrainements`)} /> : null}
        <ListRow title="Profil" subtitle="Enfants, clubs, notifications" leading={<Ionicons name="person-circle-outline" size={22} color={colors.muted} />} onPress={() => go("/profil")} />
        <ListRow title="Oublier cet appareil" leading={<Ionicons name="log-out-outline" size={22} color={colors.danger} />} onPress={forget} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  chip: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.7 },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  flex: { flex: 1, gap: 2 },
  role: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
