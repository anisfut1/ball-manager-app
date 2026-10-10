import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Configuration Expo de l'app Ball Manager (docs/MOBILE_ARCHITECTURE.md).
 *
 * Identité Apple déjà enregistrée (ne pas changer) : Team ID YFZ72KY47V,
 * Bundle ID fr.ballmanager.app — le fichier AASA servi par ball-manager-web
 * déclare `YFZ72KY47V.fr.ballmanager.app`.
 *
 * Variantes (EAS, variable APP_VARIANT) :
 *  - development : Development Client, entitlement APNs « development » ;
 *  - preview / production : entitlement APNs « production » (TestFlight, App Store).
 * L'environnement APNs RÉEL d'un jeton est relu à l'exécution
 * (src/push/apns-environment.ts), jamais déduit de cette variable.
 */
const VARIANT = process.env.APP_VARIANT === "development" ? "development" : process.env.APP_VARIANT === "preview" ? "preview" : "production";

/** Domaines Universal Links : uniquement ceux où l'AASA répond réellement (voir docs/UNIVERSAL_LINKS.md). */
const ASSOCIATED_DOMAINS = (process.env.BM_ASSOCIATED_DOMAINS ?? "www.ball-manager.fr").split(",").map((d: string) => d.trim()).filter(Boolean);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Ball Manager",
  slug: "ball-manager",
  owner: process.env.EXPO_OWNER,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "ballmanager",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "fr.ballmanager.app",
    appleTeamId: "YFZ72KY47V",
    buildNumber: "1",
    supportsTablet: false,
    associatedDomains: ASSOCIATED_DOMAINS.map((d: string) => `applinks:${d}`),
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDevelopmentRegion: "fr",
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: "fr.ballmanager.app",
    adaptiveIcon: {
      backgroundColor: "#F7F6F2",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-notifications", { mode: VARIANT === "development" ? "development" : "production" }],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#F7F6F2",
        image: "./assets/images/splash-icon.png",
        imageWidth: 88,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    variant: VARIANT,
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
