import { useEffect, useMemo } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/SessionProvider";
import { createDeduper, internalPathFor, resolveDestination } from "@/linking/resolveDestination";
import { notificationPath } from "./notification-path";
import { refreshPushRegistration, registerToken } from "./registration";

/**
 * Notification au premier plan : bannière iOS + données rafraîchies en
 * silence. Jamais en plus un toast ni une navigation automatique.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

const dedupe = createDeduper(3000);

/** Toucher une notification → MÊME résolveur que les Universal Links. */
export function openNotificationPath(path: string | null): void {
  if (!path || !dedupe(path)) return;
  const target = internalPathFor(resolveDestination(path));
  if (target) router.push(target);
}

export function PushBridge() {
  const { signedIn, state } = useSession();
  const queryClient = useQueryClient();
  const sessions = useMemo(() => Object.values(state.clubs), [state.clubs]);

  // Jeton à jour pour chaque club (réinstallation, restauration, nouveau club).
  useEffect(() => {
    if (signedIn) void refreshPushRegistration(sessions);
  }, [signedIn, sessions]);

  // APNs renouvelle le jeton : mise à jour côté serveur (sans boucle : envoi seulement s'il change).
  useEffect(() => {
    const sub = Notifications.addPushTokenListener((token) => {
      if (typeof token.data === "string") void registerToken(sessions, token.data);
    });
    return () => sub.remove();
  }, [sessions]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => void queryClient.invalidateQueries());
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => openNotificationPath(notificationPath(response.notification)));
    // App lancée par un toucher de notification (démarrage à froid).
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotificationPath(notificationPath(response.notification));
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [queryClient]);

  return null;
}
