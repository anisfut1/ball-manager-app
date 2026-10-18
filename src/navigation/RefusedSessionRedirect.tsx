import { useEffect, useRef } from "react";
import { router } from "expo-router";
import { useSession } from "@/auth/SessionProvider";

/**
 * Session du club ACTIF refusée par le back alors que d'autres clubs restent
 * connectés : renvoie vers l'identification de CE club. Les refus d'un club qui
 * n'est pas actif ne naviguent jamais (voir `RefusedClubNotices`). Quand plus
 * aucun club ne reste, c'est le garde d'authentification qui s'en charge
 * (`authGuard`).
 */
export function RefusedSessionRedirect(): null {
  const { signedIn, refusalRedirect } = useSession();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    if (!refusalRedirect) {
      sent.current = null;
      return;
    }
    if (!signedIn || sent.current === refusalRedirect) return;
    sent.current = refusalRedirect;
    router.replace(`/connexion/${refusalRedirect}`);
  }, [signedIn, refusalRedirect]);
  return null;
}
