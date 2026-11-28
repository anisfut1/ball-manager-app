import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { humanMessage } from "@/api/errors";
import { accountApi, type AccountSessionDto } from "@/api/endpoints/account";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, Screen } from "@/components/ui";
import { AccountAuthForm } from "@/features/accounts/AccountAuthForm";
import { destinationAfterLogin } from "@/navigation/after-login";

/**
 * Invitation d'un proche (`/public/{slug}/invitation#<code>`) : on se
 * connecte ou on crée son compte, puis le licencié est ajouté au compte.
 */
export default function InvitationScreen() {
  const { club = "", code = "" } = useLocalSearchParams<{ club: string; code: string }>();
  const session = useSession();
  const existing = session.state.clubs[club]?.account ? session.state.clubs[club] : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept(dto: AccountSessionDto | null) {
    setBusy(true);
    setError(null);
    try {
      const token = dto?.accessToken ?? (await session.accountToken(club));
      if (!token) throw new Error("Session expirée : reconnecte-toi.");
      await accountApi.acceptInvite(club, token, code);
      if (dto) await session.accountLogin(club, dto);
      else await session.refresh();
      router.replace(destinationAfterLogin(club, null));
    } catch (e) {
      setError(humanMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText variant="title">Tu es invité</AppText>
      <AppText variant="callout" tone="muted">
        Un proche t&apos;invite à suivre un licencié du club avec ton propre compte.
      </AppText>
      <Card>
        {existing ? (
          <>
            <AppText variant="callout" tone="muted">
              Connecté avec {existing.account?.email ?? "ton compte"}.
            </AppText>
            <Button label="Accepter l'invitation" size="lg" loading={busy} onPress={() => void accept(null)} fullWidth />
          </>
        ) : (
          <AccountAuthForm clubSlug={club || undefined} intro="Crée ton compte (ou connecte-toi) pour accepter l'invitation." onAuthenticated={(dto) => accept(dto)} />
        )}
        {error ? <Banner tone="danger" message={error} /> : null}
      </Card>
    </Screen>
  );
}
