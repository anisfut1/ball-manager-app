import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Application from "expo-application";
import * as WebBrowser from "expo-web-browser";
import { useActiveClub, useSession } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Banner, Button, Card, ListRow, Screen, SectionHeader } from "@/components/ui";
import { colors } from "@/design";
import { env } from "@/config/env";
import { ClubHeader } from "@/features/home/ClubHeader";
import { useRoles } from "@/features/roles/useRoles";
import { enablePush, pushPermission, type PushPermission } from "@/push/registration";

/** Libellés des rôles fusionnés : l'utilisateur voit ce qu'il peut faire, pas un « mode » à choisir. */
function roleLabels(roles: ReturnType<typeof useRoles>["roles"]): string[] {
  const labels: string[] = [];
  if (roles.memberTeams.length) labels.push("Parent / joueur");
  if (roles.isCoach) labels.push("Coach");
  if (roles.canManageTables) labels.push("Tables de marque");
  if (roles.canManageDerogations || roles.canCreateDerogations) labels.push("Dérogations");
  if (roles.isClubAdmin) labels.push("Administrateur du club");
  return labels;
}

/** Profil : identité, club actif, clubs, enfants liés, rôles, notifications, version, déconnexion. */
export default function ProfileScreen() {
  const club = useActiveClub();
  const { state, person, setActivePerson, setActiveClub, logout } = useSession();
  const { roles } = useRoles();
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const clubs = Object.values(state.clubs);
  const labels = roleLabels(roles);

  useEffect(() => {
    void pushPermission().then(setPermission);
  }, []);

  const activate = useCallback(async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      setPermission(await enablePush(Object.values(state.clubs)));
    } catch {
      setPushError("Impossible d'activer les notifications pour le moment. Réessaie dans un instant.");
    } finally {
      setPushBusy(false);
    }
  }, [state.clubs]);

  const confirmLogout = () =>
    Alert.alert("Se déconnecter de ce club ?", `Tu ne recevras plus les notifications de ${club.clubName} sur cet appareil.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void logout(club.clubSlug) },
    ]);

  return (
    <Screen>
      <ClubHeader title="Profil" />

      {person ? (
        <Card>
          <ListRow
            title={`${person.firstName} ${person.lastName}`}
            subtitle={club.clubName}
            leading={<Avatar firstName={person.firstName} lastName={person.lastName} size={48} />}
          />
        </Card>
      ) : null}

      {labels.length ? (
        <>
          <SectionHeader title="Mes rôles" />
          <Card>
            {labels.map((label) => (
              <Badge key={label} tone="info" label={label} />
            ))}
          </Card>
        </>
      ) : null}

      {club.people.length > 1 ? (
        <>
          <SectionHeader title="Enfants et proches liés" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {club.people.map((p) => (
              <ListRow
                key={p.licencieId}
                title={`${p.firstName} ${p.lastName}`}
                leading={<Avatar firstName={p.firstName} lastName={p.lastName} />}
                trailing={p.licencieId === person?.licencieId ? <Ionicons name="checkmark" size={20} color={colors.success} /> : undefined}
                onPress={() => void setActivePerson(p.licencieId)}
                accessibilityHint="Choisir cette personne"
              />
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Mes clubs" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        {clubs.map((c) => (
          <ListRow
            key={c.clubSlug}
            title={c.clubName}
            subtitle={c.people.map((p) => p.firstName).join(", ")}
            trailing={c.clubSlug === club.clubSlug ? <Ionicons name="checkmark" size={20} color={colors.success} /> : undefined}
            onPress={() => void setActiveClub(c.clubSlug)}
          />
        ))}
        <ListRow title="Ajouter un club" leading={<Ionicons name="add-circle-outline" size={22} color={colors.muted} />} onPress={() => router.push("/bienvenue")} />
      </Card>

      <SectionHeader title="Notifications" />
      <Card>
        {permission === "granted" ? (
          <Banner tone="success" message="Notifications activées : convocations et changements de match." />
        ) : permission === "denied" ? (
          <>
            <Banner tone="warning" message="Les notifications sont désactivées pour Ball Manager dans les réglages de l'iPhone." />
            <Button label="Ouvrir les réglages" variant="secondary" onPress={() => void Linking.openSettings()} fullWidth />
          </>
        ) : permission === "unavailable" ? (
          <AppText variant="callout" tone="muted">
            Les notifications ne sont pas disponibles sur cet appareil.
          </AppText>
        ) : (
          <>
            <AppText variant="callout" tone="muted">
              Reçois tes convocations et les changements de match.
            </AppText>
            {pushError ? <Banner tone="danger" message={pushError} /> : null}
            <Button label="Activer les notifications" loading={pushBusy} onPress={() => void activate()} fullWidth />
          </>
        )}
      </Card>

      <SectionHeader title="À propos" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow title="Confidentialité" onPress={() => void WebBrowser.openBrowserAsync(`${env.webUrl}/confidentialite`)} />
        <ListRow title="Support" onPress={() => void WebBrowser.openBrowserAsync(`${env.webUrl}/support`)} />
        <ListRow title="Version" subtitle={`${Application.nativeApplicationVersion ?? "—"} (build ${Application.nativeBuildVersion ?? "—"})`} />
      </Card>

      <Button label="Se déconnecter" variant="danger" onPress={confirmLogout} fullWidth />
    </Screen>
  );
}
