import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useActiveClub, useSession } from "@/auth/SessionProvider";
import { Avatar, Card, ListRow, Screen, SectionHeader } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { ClubHeader } from "@/features/home/ClubHeader";

type IconName = keyof typeof Ionicons.glyphMap;

function Icon({ name }: { name: IconName }) {
  const accent = useClubAccent();
  return (
    <View style={[styles.icon, { backgroundColor: accent.soft }]}>
      <Ionicons name={name} size={20} color={accent.text} />
    </View>
  );
}

/** « Plus » : ce qui ne tient pas dans la barre du bas (Résultats et Dérogations du web, planning, profil). */
export default function MoreTab() {
  const club = useActiveClub();
  const { person } = useSession();
  const base = `/c/${club.clubSlug}`;
  return (
    <Screen>
      <ClubHeader title="Plus" />
      <SectionHeader title="Le club" />
      <Card padded={false} style={styles.card}>
        <ListRow title="Résultats" subtitle="Scores des derniers matchs" leading={<Icon name="trophy-outline" />} onPress={() => router.push("/resultats")} />
        <ListRow title="Dérogations" subtitle="Demandes de changement de date ou d'horaire" leading={<Icon name="time-outline" />} onPress={() => router.push(`${base}/derogations`)} />
        <ListRow title="Mon planning" subtitle="Matchs et entraînements, semaine par semaine" leading={<Icon name="calendar-outline" />} onPress={() => router.push("/planning")} />
      </Card>
      <SectionHeader title="Moi" />
      <Card padded={false} style={styles.card}>
        <ListRow
          title={person ? `${person.firstName} ${person.lastName}` : "Profil"}
          subtitle="Profil, enfants, clubs, notifications"
          leading={person ? <Avatar firstName={person.firstName} lastName={person.lastName} size={40} /> : <Icon name="person-circle-outline" />}
          onPress={() => router.push("/profil")}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.lg },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
});
