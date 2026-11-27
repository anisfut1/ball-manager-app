import { useState } from "react";
import { Alert, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { humanMessage } from "@/api/errors";
import { accountApi } from "@/api/endpoints/account";
import { useSession } from "@/auth/SessionProvider";
import type { ClubSession } from "@/auth/session-model";
import { AppText, Avatar, Banner, Card, ListRow, SectionHeader } from "@/components/ui";
import { colors } from "@/design";

/**
 * Profil → « Mon compte » : adresse du compte, licenciés suivis et
 * invitation d'un proche (l'autre parent crée son propre compte). Session
 * d'appareil d'avant les comptes : invitation à créer son compte.
 */
export function AccountSection({ club }: { club: ClubSession }) {
  const session = useSession();
  const [error, setError] = useState<string | null>(null);

  if (!club.account) {
    return (
      <>
        <SectionHeader title="Mon compte" />
        <Card>
          <AppText variant="callout" tone="muted">
            Les liens personnels vont être remplacés par des comptes (email et mot de passe), un par personne : chaque parent peut avoir le sien.
          </AppText>
          <ListRow title="Créer mon compte" leading={<Ionicons name="person-add-outline" size={22} color={colors.muted} />} onPress={() => router.push(`/connexion/${club.clubSlug}`)} />
        </Card>
      </>
    );
  }

  async function invite(licencieId: string, firstName: string) {
    setError(null);
    try {
      const token = await session.accountToken(club.clubSlug);
      if (!token) return;
      const created = await accountApi.invite(club.clubSlug, token, licencieId);
      await Share.share({ message: `Rejoins l'espace de ${firstName} sur Ball Manager (${club.clubName}) : ${created.url}` });
    } catch (e) {
      setError(humanMessage(e));
    }
  }

  function unlink(licencieId: string, firstName: string) {
    Alert.alert(`Ne plus suivre ${firstName} ?`, "Tu ne verras plus son espace ni ses convocations sur ce compte.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Ne plus suivre",
        style: "destructive",
        onPress: () =>
          void (async () => {
            try {
              const token = await session.accountToken(club.clubSlug);
              if (!token) return;
              await accountApi.unlink(club.clubSlug, token, licencieId);
              await session.refresh();
            } catch (e) {
              setError(humanMessage(e));
            }
          })(),
      },
    ]);
  }

  return (
    <>
      <SectionHeader title="Mon compte" />
      <Card padded={false} style={{ paddingHorizontal: 16 }}>
        <ListRow title={club.account.email ?? "Compte"} subtitle="Connecté avec ce compte" leading={<Ionicons name="person-circle-outline" size={22} color={colors.muted} />} />
        {club.people.map((p) => (
          <ListRow
            key={p.licencieId}
            title={`${p.firstName} ${p.lastName}`}
            subtitle="Inviter un proche, ne plus suivre"
            leading={<Avatar firstName={p.firstName} lastName={p.lastName} />}
            trailing={<Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />}
            onPress={() =>
              Alert.alert(`${p.firstName} ${p.lastName}`, undefined, [
                { text: "Inviter un proche", onPress: () => void invite(p.licencieId, p.firstName) },
                { text: "Ne plus suivre", style: "destructive", onPress: () => unlink(p.licencieId, p.firstName) },
                { text: "Annuler", style: "cancel" },
              ])
            }
            accessibilityHint="Inviter un proche (l'autre parent crée son compte) ou ne plus suivre"
          />
        ))}
      </Card>
      {error ? <Banner tone="danger" message={error} /> : null}
    </>
  );
}
