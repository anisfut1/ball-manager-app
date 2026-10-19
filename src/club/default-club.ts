import { z } from "zod";
import type { SecretStorage } from "@/auth/secure-storage";

/**
 * Club choisi sur « Choisis ton club », mémorisé comme club par défaut :
 * aux lancements suivants l'app s'ouvre directement sur son espace (comme
 * /public/{club} sur le web), sans connexion. Rien de secret ici : nom,
 * logo et couleur servent à afficher l'espace tout de suite, hors ligne
 * compris ; ils sont rafraîchis depuis l'API.
 */
export const DEFAULT_CLUB_KEY = "bm.default-club.v1";

const DefaultClubSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  name: z.string().nullable().default(null),
  logoUrl: z.string().nullable().default(null),
  accentColor: z.string().nullable().default(null),
  timezone: z.string().default("Europe/Paris"),
});

export type DefaultClub = z.infer<typeof DefaultClubSchema>;
export type DefaultClubInput = Pick<DefaultClub, "slug"> & Partial<Omit<DefaultClub, "slug">>;

export function parseDefaultClub(raw: string | null): DefaultClub | null {
  if (!raw) return null;
  try {
    const result = DefaultClubSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function toDefaultClub(input: DefaultClubInput): DefaultClub {
  return DefaultClubSchema.parse(input);
}

export function createDefaultClubRepository(storage: SecretStorage) {
  return {
    async load(): Promise<DefaultClub | null> {
      try {
        return parseDefaultClub(await storage.get(DEFAULT_CLUB_KEY));
      } catch {
        return null;
      }
    },
    async save(club: DefaultClub | null): Promise<void> {
      try {
        if (club) await storage.set(DEFAULT_CLUB_KEY, JSON.stringify(club));
        else await storage.remove(DEFAULT_CLUB_KEY);
      } catch {
        // Préférence de confort : l'app reste utilisable sans.
      }
    },
  };
}
