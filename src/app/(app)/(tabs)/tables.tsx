import { useCurrentClubState } from "@/club/CurrentClubProvider";
import { LicensedGateScreen } from "@/features/licensed-access/LicensedGateScreen";
import { TablesView } from "../c/[clubSlug]/tables";

/** Onglet « Tables » (comme la barre du bas du web) : réservé aux licenciés. */
export default function TablesTab() {
  const { session, switching } = useCurrentClubState();
  return session ? <TablesView tab /> : switching ? null : <LicensedGateScreen module="tables" />;
}
