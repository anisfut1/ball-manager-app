import { Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useQuery } from "@tanstack/react-query";
import { adminApi, adminSignOut } from "@/api/endpoints/admin";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Button, Card, ListRow, SectionHeader } from "@/components/ui";
import { env } from "@/config/env";
import { colors } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";

/** Pages d'administration encore propres au site (lot 2 dans l'app). */
const WEB_PAGES: { title: string; path: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { title: "Équipes", path: "admin/teams", icon: "people-outline" },
  { title: "Dérogations FBI", path: "admin/derogations", icon: "swap-horizontal-outline" },
  { title: "Synchronisation FFBB", path: "admin/sync", icon: "sync-outline" },
  { title: "Intégrations (FBI, e-Marque)", path: "admin/integrations", icon: "link-outline" },
  { title: "Statistiques", path: "admin/stats", icon: "stats-chart-outline" },
  { title: "Paramètres du club", path: "admin/settings", icon: "settings-outline" },
];

/** Accueil de l'administration du club (comptes administrateurs du site uniquement). */
export default function AdminHomeScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const issues = useQuery({ queryKey: queryKeys.adminIssues(slug), queryFn: () => adminApi.issues(slug) });
  const open = (issues.data ?? []).filter((i) => i.status !== "auto_corrected");
  const errors = open.filter((i) => i.severity === "error").length;

  const signOut = () =>
    Alert.alert("Se déconnecter de l'administration ?", "Il faudra te reconnecter avec ton compte du site pour revenir ici.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void adminSignOut(slug) },
    ]);

  const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={22} color={colors.muted} />;

  return (
    <AdminScreen title="Administration" onRefresh={() => void issues.refetch()}>
      {(session) => (
        <>
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            <ListRow
              title="Anomalies"
              subtitle={issues.isPending ? "Chargement…" : open.length ? `${open.length} à traiter` : "Rien à signaler"}
              leading={icon("alert-circle-outline")}
              trailing={errors ? <Badge tone="danger" label={`${errors} à corriger`} /> : undefined}
              onPress={() => router.push(`/c/${slug}/admin/anomalies`)}
            />
            <ListRow title="Gymnases" subtitle="Gymnases proposés et indisponibilités" leading={icon("business-outline")} onPress={() => router.push(`/c/${slug}/admin/gymnases`)} />
            <ListRow title="Réservation salle" subtitle="Planning mensuel des matchs" leading={icon("calendar-outline")} onPress={() => router.push(`/c/${slug}/admin/reservation-salle`)} />
          </Card>

          <SectionHeader title="Sur le site" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {WEB_PAGES.map((page) => (
              <ListRow
                key={page.path}
                title={page.title}
                leading={icon(page.icon)}
                trailing={<Ionicons name="open-outline" size={18} color={colors.subtle} />}
                onPress={() => void WebBrowser.openBrowserAsync(`${env.webUrl}/c/${slug}/${page.path}`)}
              />
            ))}
          </Card>

          <AppText variant="meta" tone="muted">{`Connecté en administrateur${session.email ? ` : ${session.email}` : ""}.`}</AppText>
          <Button label="Se déconnecter de l'administration" variant="secondary" onPress={signOut} fullWidth />
        </>
      )}
    </AdminScreen>
  );
}
