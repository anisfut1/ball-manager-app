import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api/endpoints/auth";
import { queryKeys } from "@/api/queryKeys";
import { useSession } from "@/auth/SessionProvider";
import { secureStorage } from "@/auth/secure-storage";
import type { ClubSession } from "@/auth/session-model";
import { createDefaultClubRepository, toDefaultClub, type DefaultClub, type DefaultClubInput } from "./default-club";

const repository = createDefaultClubRepository(secureStorage);

/** Club affiché (espace public du club, comme /public/{club} sur le web). */
export interface CurrentClub {
  slug: string;
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  timezone: string;
}

export interface CurrentClubValue {
  /** false tant que le club mémorisé n'est pas relu (le splash reste affiché). */
  ready: boolean;
  club: CurrentClub | null;
  /** Session d'appareil de CE club (licencié reconnu), sinon null : seules les pages publiques s'affichent. */
  session: ClubSession | null;
  /** L'appareil a une session pour ce club, en train de devenir le club actif (un instant). */
  switching: boolean;
  /** Choisit le club (« Choisis ton club », lien vers un autre club) et le mémorise comme club par défaut. */
  chooseClub(club: DefaultClubInput): void;
}

const CurrentClubContext = createContext<CurrentClubValue | null>(null);

/**
 * Club par défaut, comme l'espace public du web : on choisit son club une
 * fois, l'app s'y rouvre ensuite directement. L'identification (session
 * d'appareil) est facultative ; quand elle existe pour ce club, il devient
 * aussi le club actif de la session (les écrans réservés en dépendent).
 */
export function CurrentClubProvider({ children }: { children: ReactNode }) {
  const { state, setActiveClub } = useSession();
  const [chosen, setChosen] = useState<DefaultClub | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    void repository.load().then((club) => {
      if (!alive) return;
      setChosen(club);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const chooseClub = useCallback((input: DefaultClubInput) => {
    setChosen((previous) => toDefaultClub(previous?.slug === input.slug ? { ...previous, ...stripUndefined(input) } : input));
  }, []);

  // Nouvelle identification (lien, code, SSO) : ce club devient le club affiché.
  // Une session retirée (expirée, déconnexion) ne change jamais de club.
  const knownClubs = useRef(new Set(Object.keys(state.clubs)));
  useEffect(() => {
    const added = Object.keys(state.clubs).filter((s) => !knownClubs.current.has(s));
    knownClubs.current = new Set(Object.keys(state.clubs));
    if (!loaded) return;
    const session = added.length ? state.clubs[state.active && added.includes(state.active) ? state.active : added[0]] : null;
    if (session) chooseClub({ slug: session.clubSlug, name: session.clubName, accentColor: session.accentColor, timezone: session.timezone });
  }, [loaded, state.active, state.clubs, chooseClub]);

  // Mise à niveau : déjà connecté mais aucun club mémorisé → le club de la session.
  const fallback = !chosen && state.active ? state.clubs[state.active] : null;
  const base: DefaultClub | null = chosen ?? (fallback ? toDefaultClub({ slug: fallback.clubSlug, name: fallback.clubName, accentColor: fallback.accentColor, timezone: fallback.timezone }) : null);
  const slug = base?.slug ?? null;
  const member = !!(slug && state.clubs[slug]);
  // Club affiché dont l'appareil a une session : il devient le club actif.
  useEffect(() => {
    if (slug && member && state.active !== slug) void setActiveClub(slug);
  }, [slug, member, state.active, setActiveClub]);

  // Nom, logo et couleur à jour (mis en cache une heure) ; la copie mémorisée sert hors ligne.
  // Seul écrivain du club mémorisé.
  const info = useQuery({ queryKey: queryKeys.club(slug ?? ""), queryFn: () => authApi.club(slug ?? ""), enabled: !!slug, staleTime: 60 * 60_000 });
  const fresh = info.data && info.data.slug === slug ? info.data : null;
  const shown = useMemo<DefaultClub | null>(() => (base && fresh ? { ...base, name: fresh.name, logoUrl: fresh.logoUrl, accentColor: fresh.accentColor, timezone: fresh.timezone } : base), [base, fresh]);
  const shownKey = shown ? JSON.stringify(shown) : null;
  useEffect(() => {
    if (loaded && shownKey) void repository.save(JSON.parse(shownKey) as DefaultClub);
  }, [loaded, shownKey]);

  const value = useMemo<CurrentClubValue>(() => {
    const session = slug ? (state.clubs[slug] ?? null) : null;
    const club: CurrentClub | null = shown
      ? { slug: shown.slug, name: shown.name ?? session?.clubName ?? shown.slug, logoUrl: shown.logoUrl, accentColor: shown.accentColor ?? session?.accentColor ?? null, timezone: shown.timezone }
      : null;
    // La session n'est exposée qu'une fois devenue le club actif (useActiveClub en dépend).
    return { ready: loaded, club, session: session && state.active === slug ? session : null, switching: !!session && state.active !== slug, chooseClub };
  }, [loaded, shown, slug, state.clubs, state.active, chooseClub]);

  return <CurrentClubContext.Provider value={value}>{children}</CurrentClubContext.Provider>;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function useCurrentClubState(): CurrentClubValue {
  const value = useContext(CurrentClubContext);
  if (!value) throw new Error("useCurrentClubState hors de CurrentClubProvider");
  return value;
}

/** Club affiché garanti (écrans de l'espace du club, sous le garde de navigation). */
export function useCurrentClub(): CurrentClub & { session: ClubSession | null } {
  const { club, session } = useCurrentClubState();
  if (!club) throw new Error("Aucun club choisi");
  return { ...club, session };
}
