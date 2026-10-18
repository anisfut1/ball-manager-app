import { Redirect } from "expo-router";

/** `/c/{slug}/matchs` : le club est devenu actif (layout) → l'onglet Matchs. */
export default function ClubMatches() {
  return <Redirect href="/matchs" />;
}
