import * as Crypto from "expo-crypto";
import { base64url, utf8 } from "./base64url";

/**
 * PKCE S256 (RFC 7636) — même protocole que la page web
 * `/public/{slug}/auth/app` et `ball-manager-back` : verifier 32 octets aléatoires (43 caractères),
 * challenge = base64url(SHA-256(verifier)), state aléatoire 16 octets.
 */
export interface Pkce {
  verifier: string;
  challenge: string;
  state: string;
}

export interface PkceDeps {
  randomBytes(count: number): Uint8Array;
  sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array>;
}

const expoDeps: PkceDeps = {
  randomBytes: (count) => Crypto.getRandomBytes(count),
  sha256: async (data) => new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data)),
};

export async function createPkce(deps: PkceDeps = expoDeps): Promise<Pkce> {
  const verifier = base64url(deps.randomBytes(32));
  const challenge = base64url(await deps.sha256(utf8(verifier)));
  const state = base64url(deps.randomBytes(16));
  return { verifier, challenge, state };
}
