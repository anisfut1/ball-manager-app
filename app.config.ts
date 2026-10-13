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
  slug: "ball-manager-app",
  // Projet EAS @rmessas-team/ball-manager-app (créé le 2026-10-13). Valeurs publiques, pas des secrets.
  owner: "rmessas-team",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "ballmanager",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "fr.ballmanager.app",
    appleTeamId: "YFZ72KY47V",
    supportsTablet: false,
    associatedDomains: ASSOCIATED_DOMAINS.map((d: string) => `applinks:${d}`),
    config: { usesNonExemptEncryption: false },
    // Raisons des « required reason APIs » du socle React Native / Expo (docs/APP_STORE.md).
    // À confirmer avec le courriel d'Apple après le premier envoi TestFlight.
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1", "0A2A.1", "3B52.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime", NSPrivacyAccessedAPITypeReasons: ["35F9.1"] },
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace", NSPrivacyAccessedAPITypeReasons: ["E174.1", "85F4.1"] },
      ],
    },
    infoPlist: {
      CFBundleDevelopmentRegion: "fr",
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    package: "fr.ballmanager.app",
    adaptiveIcon: {
      backgroundColor: "#111111",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    // Pas de biométrie : aucune permission Face ID déclarée.
    ["expo-secure-store", { faceIDPermission: false }],
    ["expo-notifications", { mode: VARIANT === "development" ? "development" : "production" }],
    [
      "expo-splash-screen",
      {
        // Logo BM sur tuile noire, posé sur le même noir : aucun bord visible.
        backgroundColor: "#111111",
        image: "./assets/images/splash-icon.png",
        imageWidth: 160,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    reactCompiler: true,
  },
  extra: {
    variant: VARIANT,
    eas: { projectId: "5b55c4d4-edf4-401e-80ff-9728352ccb6b" },
  },
});
