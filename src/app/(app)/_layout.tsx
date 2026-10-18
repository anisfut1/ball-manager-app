import { Redirect, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { authGuard } from "@/navigation/auth-guard";
import { setPendingDestination } from "@/linking/pendingDestination";
import { colors } from "@/design";

/** Garde d'authentification : voir `authGuard`. */
export default function AppLayout() {
  const { signedIn, status, refusalRedirect } = useSession();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string>>();
  const decision = authGuard({ signedIn, status, pathname, params, refusalRedirect });
  if (decision) {
    if (decision.pending) setPendingDestination(decision.pending);
    return <Redirect href={decision.redirect} />;
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
