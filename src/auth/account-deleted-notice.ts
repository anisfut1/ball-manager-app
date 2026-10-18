import { useSyncExternalStore } from "react";

/**
 * Message « Ton compte a été supprimé » affiché sur l'accueil non connecté.
 * En mémoire seulement : il disparaît dès qu'on se reconnecte ou qu'on relance l'app.
 */
let shown = false;
const listeners = new Set<() => void>();

function set(value: boolean): void {
  if (shown === value) return;
  shown = value;
  for (const listener of listeners) listener();
}

export const markAccountDeleted = () => set(true);
export const clearAccountDeletedNotice = () => set(false);

export function useAccountDeletedNotice(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    () => shown,
    () => shown,
  );
}
