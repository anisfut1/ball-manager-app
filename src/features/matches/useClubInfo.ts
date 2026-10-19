import { useCurrentClub } from "@/club/CurrentClubProvider";

/** Nom, logo et couleur du club affiché (choisi sur « Choisis ton club », rafraîchis depuis l'API). */
export function useClubInfo() {
  const club = useCurrentClub();
  return { slug: club.slug, name: club.name, logoUrl: club.logoUrl, accentColor: club.accentColor, timezone: club.timezone };
}
