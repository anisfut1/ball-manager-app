import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { authApi } from "@/api/endpoints/auth";
import type { ClubSession } from "@/auth/session-model";
import { currentApnsEnvironment, type ApnsEnvironment } from "./apns-environment";

/**
 * Notifications APNs DIRECTES (ball-manager-back, docs/PUSH.md) : jeton
 * natif (`getDevicePushTokenAsync`, PAS le jeton Expo), rattaché à la
 * session d'appareil de CHAQUE club. Aucune infrastructure tierce.
 * La permission n'est jamais demandée au lancement : seulement depuis un
 * écran qui explique pourquoi, après connexion.
 */
export type PushPermission = "granted" | "denied" | "undetermined" | "unavailable";

export async function pushPermission(): Promise<PushPermission> {
  if (Platform.OS !== "ios") return "unavailable";
  const status = await Notifications.getPermissionsAsync();
  return status.granted ? "granted" : status.canAskAgain ? "undetermined" : "denied";
}

/** Jetons déjà envoyés (par club) : pas de boucle d'enregistrement. */
const registered = new Map<string, string>();

export function registrationKey(token: string, environment: ApnsEnvironment): string {
  return `${environment}:${token}`;
}

async function sendToken(session: ClubSession, token: string, environment: ApnsEnvironment): Promise<void> {
  const key = registrationKey(token, environment);
  if (registered.get(session.clubSlug) === key) return;
  await authApi.registerPushToken(session.clubSlug, session.secret, { token, environment, appVersion: Application.nativeApplicationVersion ?? undefined });
  registered.set(session.clubSlug, key);
}

export async function registerToken(sessions: ClubSession[], token: string): Promise<void> {
  const environment = await currentApnsEnvironment();
  if (!environment) return;
  await Promise.all(sessions.map((s) => sendToken(s, token, environment).catch(() => undefined)));
}

/** Geste de l'utilisateur : demande la permission, puis enregistre le jeton pour chaque club. */
export async function enablePush(sessions: ClubSession[]): Promise<PushPermission> {
  if (Platform.OS !== "ios") return "unavailable";
  let permission = await pushPermission();
  if (permission === "undetermined") {
    const result = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    permission = result.granted ? "granted" : "denied";
  }
  if (permission !== "granted") return permission;
  const token = await Notifications.getDevicePushTokenAsync();
  if (typeof token.data === "string") await registerToken(sessions, token.data);
  return "granted";
}

/** Au démarrage : permission déjà accordée → le jeton peut avoir changé (réinstallation, restauration). */
export async function refreshPushRegistration(sessions: ClubSession[]): Promise<void> {
  if (sessions.length === 0 || (await pushPermission()) !== "granted") return;
  const token = await Notifications.getDevicePushTokenAsync().catch(() => null);
  if (token && typeof token.data === "string") await registerToken(sessions, token.data);
}

/** État local seulement (aucun appel réseau) : le jeton de ce club n'est plus considéré comme enregistré. */
export function forgetPushRegistration(clubSlug: string): void {
  registered.delete(clubSlug);
}

/** Plus de notifications de ce club sur cet appareil (déconnexion, ou choix dans le profil). */
export async function detachPush(session: ClubSession): Promise<void> {
  forgetPushRegistration(session.clubSlug);
  await authApi.removePushToken(session.clubSlug, session.secret).catch(() => undefined);
}

/** Réservé aux tests. */
export function resetRegistrationCacheForTests(): void {
  registered.clear();
}
