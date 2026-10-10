import { Redirect, Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { setPendingDestination } from "@/linking/pendingDestination";
import { colors } from "@/design";

const KEPT_PARAMS = ["section", "tab"] as const;

/**
 * Garde d'authentification (UX seulement : la sécurité réelle est l'API).
 * Pas connecté : la destination demandée est mise de côté, puis connexion.
 */
export default function AppLayout() {
  const { signedIn, status } = useSession();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string>>();
  if (!signedIn) {
    const query = new URLSearchParams();
    for (const key of KEPT_PARAMS) if (typeof params[key] === "string") query.set(key, params[key]);
    const route = `${pathname}${query.toString() ? `?${query.toString()}` : ""}`;
    const clubSlug = /^\/c\/([a-z0-9-]+)/.exec(pathname)?.[1] ?? null;
    if (route !== "/") setPendingDestination({ clubSlug, route });
    return <Redirect href={status === "EXPIRED" ? "/session-expiree" : clubSlug ? `/connexion/${clubSlug}` : "/bienvenue"} />;
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
