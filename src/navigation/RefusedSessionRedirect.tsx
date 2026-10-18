import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { useSession } from "@/auth/SessionProvider";

/**
 * Session d'un club refusée par le back alors que d'autres clubs restent
 * connectés : renvoie vers l'identification de CE club (les autres sessions
 * sont intactes). Quand plus aucun club ne reste, c'est le garde
 * d'authentification qui s'en charge (`authGuard`).
 */
export function RefusedSessionRedirect(): null {
  const { signedIn, refusedClub } = useSession();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!refusedClub) {
      sent.current = null;
      return;
    }
    if (!signedIn || sent.current === refusedClub) return;
    sent.current = refusedClub;
    router.replace(`/connexion/${refusedClub}`);
  }, [signedIn, refusedClub]);
  return null;
}
