import { useRoles } from "@/features/roles/useRoles";

/**
 * Qui agit sur les dérogations (comme l'identité du web) :
 *  - `as` : coordinateur, sinon coach autorisé, sinon admin du club ;
 *  - `hasAccess` : admin, coach ou coordinateur (sinon « Accès réservé ») ;
 *  - `official` : personne qui voit / traite les dérogations officielles FBI
 *    (coordinateur ou admin du club), `null` sinon.
 * Le serveur revérifie chaque droit (403 sinon).
 */
export function useDerogationActor(): { as: string | null; hasAccess: boolean; official: string | null; loading: boolean } {
  const { roles, loading } = useRoles();
  const as = roles.actorFor("derogations");
  return { as, hasAccess: as !== null, official: roles.actorFor("official"), loading };
}
