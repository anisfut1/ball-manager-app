import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { humanMessage } from "@/api/errors";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Banner, Button, CardSkeletons, Screen } from "@/components/ui";
import { destinationAfterLogin } from "@/navigation/after-login";

/**
 * Lien de connexion à usage unique (`/public/{slug}/connexion/code/{code}`).
 * L'échange est un POST fait par l'app : un scanner d'email qui précharge
 * le lien ne consomme jamais le code.
 */
export default function LoginCodeScreen() {
  const { club = "", code = "" } = useLocalSearchParams<{ club: string; code: string }>();
  const { loginWithCode } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loginWithCode(club, code)
      .then((redirect) => alive && router.replace(destinationAfterLogin(club, redirect)))
      .catch((e: unknown) => alive && setError(humanMessage(e)));
    return () => {
      alive = false;
    };
  }, [club, code, loginWithCode]);

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
