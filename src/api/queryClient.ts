import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import { ApiError } from "./errors";

/**
 * Cache des données : dernières données gardées à l'écran (jamais d'écran
 * blanc hors ligne), rafraîchies au retour au premier plan. Pas de nouvel
 * essai automatique sur une erreur métier (401/403/404/409/422).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        retry: (count, error) => (error instanceof ApiError && error.kind !== "offline" && error.kind !== "timeout" && error.kind !== "server" ? false : count < 2),
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  });
}

/** Retour au premier plan = données rafraîchies (équivalent du focus fenêtre sur le web). */
export function bindAppFocus(): () => void {
  if (Platform.OS === "web") return () => undefined;
  const sub = AppState.addEventListener("change", (status) => focusManager.setFocused(status === "active"));
  return () => sub.remove();
}
