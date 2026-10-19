import { useEffect } from "react";
import { Stack, useLocalSearchParams, usePathname } from "expo-router";
import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { colors } from "@/design";
import { LicensedGateScreen } from "@/features/licensed-access/LicensedGateScreen";
import { moduleForRoute } from "@/features/licensed-access/modules";
import { isPublicClubRoute } from "@/navigation/public-routes";

/**
 * Lien vers un club (`/c/{club}/…`) : ce club devient le club affiché et
 * mémorisé. Pages publiques (résultats, matchs, fiche match, classement des
 * tables, fiche joueur) : ouvertes sans connexion. Pages réservées : la
 * porte « Accès réservé aux licenciés » tant que personne n'est reconnu
 * pour ce club (la destination est retrouvée après l'identification).
 */
export default function ClubGateLayout() {
  const { clubSlug = "" } = useLocalSearchParams<{ clubSlug: string }>();
  const pathname = usePathname();
  const { club, session, switching, chooseClub } = useCurrentClubState();
  const current = club?.slug === clubSlug;

  useEffect(() => {
    if (clubSlug && !current) chooseClub({ slug: clubSlug });
  }, [clubSlug, current, chooseClub]);

  if (!current || switching) return null;
  if (!session && !isPublicClubRoute(pathname)) return <LicensedGateScreen module={moduleForRoute(pathname)} stacked />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
