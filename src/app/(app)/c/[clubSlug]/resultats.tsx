import { Redirect } from "expo-router";

/** `/c/{slug}/resultats` : le club est devenu actif (layout) → ses résultats. */
export default function ClubResults() {
  return <Redirect href="/resultats" />;
}
