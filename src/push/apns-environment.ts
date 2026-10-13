import * as Application from "expo-application";
import { Platform } from "react-native";

export type ApnsEnvironment = "development" | "production";

/**
 * Environnement APNs RÉEL du jeton, lu dans le profil de signature de l'app
 * (entitlement `aps-environment`) — jamais déduit de `__DEV__`/NODE_ENV
 * (un jeton sandbox déclaré production ne recevrait aucune notification).
 * TestFlight / App Store = production. `null` : simulateur ou inconnu → pas
 * d'enregistrement (le backend refuserait le jeton de toute façon).
 */
export function toApnsEnvironment(value: unknown): ApnsEnvironment | null {
  return value === "development" || value === "production" ? value : null;
}

export async function currentApnsEnvironment(): Promise<ApnsEnvironment | null> {
  if (Platform.OS !== "ios") return null;
  try {
    return toApnsEnvironment(await Application.getIosPushNotificationServiceEnvironmentAsync());
  } catch {
    return null;
  }
}
