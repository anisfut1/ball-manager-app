import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { LicensedGateScreen } from "@/features/licensed-access/LicensedGateScreen";
import { DerogationsView } from "../c/[clubSlug]/derogations";

/** Onglet « Dérogations » (comme la barre du bas du web) : réservé aux licenciés. */
export default function DerogationsTab() {
  const { session, switching } = useCurrentClubState();
  return session ? <DerogationsView tab /> : switching ? null : <LicensedGateScreen module="derogations" />;
}
