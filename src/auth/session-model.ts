import { z } from "zod";

/**
 * Sessions d'appareil (une par club) — modèle PUR, testé. Le secret `bmd_…`
 * est une preuve DÉRIVÉE du lien personnel ; le lien personnel lui-même
 * n'est jamais conservé sur le téléphone.
 */
const PersonSchema = z.object({ licencieId: z.string().min(1), firstName: z.string(), lastName: z.string(), teamId: z.string().nullable() });
const ClubSessionSchema = z.object({
  clubSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  clubName: z.string(),
  accentColor: z.string().nullable().default(null),
  timezone: z.string().default("Europe/Paris"),
  secret: z.string().regex(/^bmd_[A-Za-z0-9_-]{20,}$/),
  people: z.array(PersonSchema),
  activeLicencieId: z.string().nullable(),
});
const StateSchema = z.object({ v: z.literal(1), active: z.string().nullable(), clubs: z.record(z.string(), ClubSessionSchema) });

export type SessionPerson = z.infer<typeof PersonSchema>;
export type ClubSession = z.infer<typeof ClubSessionSchema>;
export type SessionState = z.infer<typeof StateSchema>;

export const EMPTY_STATE: SessionState = { v: 1, active: null, clubs: {} };

/** Données illisibles ou d'un autre format : état vide (jamais un plantage au démarrage). */
export function parseState(raw: string | null): SessionState {
  if (!raw) return EMPTY_STATE;
  try {
    const result = StateSchema.safeParse(JSON.parse(raw));
    if (!result.success) return EMPTY_STATE;
    const state = result.data;
    const active = state.active && state.clubs[state.active] ? state.active : (Object.keys(state.clubs)[0] ?? null);
    return { ...state, active };
  } catch {
    return EMPTY_STATE;
  }
}

export function serializeState(state: SessionState): string {
  return JSON.stringify(state);
}

export function hasClubs(state: SessionState): boolean {
  return Object.keys(state.clubs).length > 0;
}

export function activeClub(state: SessionState): ClubSession | null {
  return (state.active && state.clubs[state.active]) || null;
}

/** Personne active valide, sinon la première de la session. */
export function activePerson(session: ClubSession): SessionPerson | null {
  return session.people.find((p) => p.licencieId === session.activeLicencieId) ?? session.people[0] ?? null;
}

export function withClub(state: SessionState, session: ClubSession, makeActive = true): SessionState {
  return { v: 1, active: makeActive ? session.clubSlug : (state.active ?? session.clubSlug), clubs: { ...state.clubs, [session.clubSlug]: session } };
}

export function withoutClub(state: SessionState, clubSlug: string): SessionState {
  const clubs = { ...state.clubs };
  delete clubs[clubSlug];
  const active = state.active === clubSlug ? (Object.keys(clubs)[0] ?? null) : state.active;
  return { v: 1, active, clubs };
}

export function withPeople(state: SessionState, clubSlug: string, people: SessionPerson[]): SessionState {
  const session = state.clubs[clubSlug];
  if (!session) return state;
  const activeLicencieId = people.some((p) => p.licencieId === session.activeLicencieId) ? session.activeLicencieId : (people[0]?.licencieId ?? null);
  return { ...state, clubs: { ...state.clubs, [clubSlug]: { ...session, people, activeLicencieId } } };
}

export function withActivePerson(state: SessionState, clubSlug: string, licencieId: string): SessionState {
  const session = state.clubs[clubSlug];
  if (!session || !session.people.some((p) => p.licencieId === licencieId)) return state;
  return { ...state, clubs: { ...state.clubs, [clubSlug]: { ...session, activeLicencieId: licencieId } } };
}

export function withActiveClub(state: SessionState, clubSlug: string): SessionState {
  return state.clubs[clubSlug] ? { ...state, active: clubSlug } : state;
}
