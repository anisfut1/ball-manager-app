import { Redirect } from "expo-router";

/** `/c/{slug}` : le club est devenu actif (layout) → son accueil. */
export default function ClubHome() {
  return <Redirect href="/" />;
}
