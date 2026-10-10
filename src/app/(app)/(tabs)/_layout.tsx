import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName, active: IconName) =>
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? active : name} color={color} size={size} />;
  };

/** Quatre onglets : l'accueil est le centre du produit. */
export default function TabsLayout() {
  const accent = useClubAccent();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent.text,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: icon("home-outline", "home") }} />
      <Tabs.Screen name="planning" options={{ title: "Planning", tabBarIcon: icon("calendar-outline", "calendar") }} />
      <Tabs.Screen name="equipes" options={{ title: "Équipes", tabBarIcon: icon("people-outline", "people") }} />
      <Tabs.Screen name="profil" options={{ title: "Profil", tabBarIcon: icon("person-circle-outline", "person-circle") }} />
    </Tabs>
  );
}
