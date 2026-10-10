import * as SecureStore from "expo-secure-store";

/**
 * Stockage des secrets de session : Keychain iOS (Keystore Android) via
 * expo-secure-store. JAMAIS AsyncStorage / localStorage pour un secret.
 * `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` : lisible après le premier
 * déverrouillage (notifications en arrière-plan), jamais restauré sur un
 * autre appareil ni sauvegardé dans iCloud.
 */
export interface SecretStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export const secureStorage: SecretStorage = {
  get: (key) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};

/** Implémentation en mémoire (tests). */
export function memoryStorage(initial: Record<string, string> = {}): SecretStorage & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data),
  };
}
