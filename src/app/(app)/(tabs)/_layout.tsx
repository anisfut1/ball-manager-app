import { Tabs } from "expo-router";
import { View, type ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { colors } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, active: IconName, locked = false) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return (
      <View>
        <Ionicons name={focused ? active : name} color={color} size={size} />
        {locked ? <Ionicons name="lock-closed" size={10} color={colors.subtle} style={{ position: "absolute", right: -6, top: -2 }} /> : null}
      </View>
    );
  };

/**
 * Barre du bas identique à celle de l'espace public du web (PublicNav) :
 * Accueil, Équipe, Résultats, Matchs, Tables, Dérogations. Résultats et
 * Matchs sont publics ; les autres affichent la porte « Accès réservé aux
 * licenciés » tant que personne n'est reconnu (cadenas sur Dérogations,
 * comme le web).
 */
export default function TabsLayout() {
  const accent = useClubAccent();
  const { session } = useCurrentClubState();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent.text,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: icon("home-outline", "home") }} />
      <Tabs.Screen name="equipes" options={{ title: "Équipe", tabBarIcon: icon("people-outline", "people") }} />
      <Tabs.Screen name="resultats" options={{ title: "Résultats", tabBarIcon: icon("trophy-outline", "trophy") }} />
      <Tabs.Screen name="matchs" options={{ title: "Matchs", tabBarIcon: icon("calendar-outline", "calendar") }} />
      <Tabs.Screen name="tables" options={{ title: "Tables", tabBarIcon: icon("clipboard-outline", "clipboard") }} />
      <Tabs.Screen name="derogations" options={{ title: "Dérogations", tabBarIcon: icon("time-outline", "time", !session) }} />
    </Tabs>
  );
}
