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

/**
 * Barre du bas alignée sur celle du web (PublicNav) : Accueil, Équipe,
 * Matchs, Tables ; « Plus » regroupe Résultats, Dérogations, planning et profil
 * (au-delà de cinq onglets, iOS masquerait le reste).
 */
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
      <Tabs.Screen name="equipes" options={{ title: "Équipe", tabBarIcon: icon("people-outline", "people") }} />
      <Tabs.Screen name="matchs" options={{ title: "Matchs", tabBarIcon: icon("calendar-outline", "calendar") }} />
      <Tabs.Screen name="tables" options={{ title: "Tables", tabBarIcon: icon("clipboard-outline", "clipboard") }} />
      <Tabs.Screen name="plus" options={{ title: "Plus", tabBarIcon: icon("ellipsis-horizontal-circle-outline", "ellipsis-horizontal-circle") }} />
    </Tabs>
  );
}
