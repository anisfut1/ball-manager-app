/**
 * Le stockage sécurisé (Keychain / Keystore) n'a pas pu être lu : appareil verrouillé, erreur système.
 * Levée à la place d'une écriture quand l'état stocké est inconnu — pour ne jamais écraser des
 * sessions qu'on n'a pas pu relire (A2, docs/AUDIT_SECURITE_2026-11.md).
 */
export class SessionStorageUnavailableError extends Error {
  constructor() {
    super("Stockage sécurisé indisponible : déverrouille ton téléphone puis réessaie.");
    this.name = "SessionStorageUnavailableError";
  }
}
