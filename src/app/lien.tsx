import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { humanMessage } from "@/api/errors";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Banner, Button, CardSkeletons, Screen } from "@/components/ui";
import { setPendingDestination } from "@/linking/pendingDestination";
import { destinationAfterLogin } from "@/navigation/after-login";

/**
 * Lien personnel reçu (`?token=`) : échangé UNE fois contre une session
 * d'appareil (ou ajoute la personne si déjà connecté), puis oublié.
 */
export default function PersonalLinkScreen() {
  const { club = "", token = "", next = "" } = useLocalSearchParams<{ club: string; token: string; next: string }>();
  const { bootstrapFromToken } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (next.startsWith(`/c/${club}`)) setPendingDestination({ clubSlug: club, route: next });
    bootstrapFromToken(club, token)
      .then(() => alive && router.replace(destinationAfterLogin(club, null)))
      .catch((e: unknown) => alive && setError(humanMessage(e)));
    return () => {
      alive = false;
    };
  }, [club, token, next, bootstrapFromToken]);

  return (
    <Screen>
      <AppText variant="title">Connexion…</AppText>
      {error ? (
        <>
          <Banner tone="danger" message={error} />
          <Button label="Recevoir un nouveau lien" onPress={() => router.replace(`/connexion/${club}`)} fullWidth />
        </>
      ) : (
        <CardSkeletons count={1} />
      )}
    </Screen>
  );
}
