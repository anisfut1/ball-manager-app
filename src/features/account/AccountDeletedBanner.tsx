import { useAccountDeletedNotice } from "@/auth/account-deleted-notice";
import { Banner } from "@/components/ui";

/** Accueil non connecté, juste après la suppression du compte. */
export function AccountDeletedBanner() {
  return useAccountDeletedNotice() ? <Banner tone="success" message="Ton compte a été supprimé." /> : null;
}
