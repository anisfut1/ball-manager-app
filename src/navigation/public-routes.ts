/**
 * Pages d'un club ouvertes à tous, comme sur /public/{club} du web :
 * accueil du lien (redirigé vers les onglets), résultats, matchs, fiche
 * match, classement des tables, fiche joueur. Le reste demande d'être
 * reconnu pour ce club.
 */
const PUBLIC_ROUTES = /^\/c\/[a-z0-9-]+(\/?$|\/(resultats|matchs)\/?$|\/matchs\/[^/]+\/?$|\/tables\/classement\/?$|\/joueurs\/[^/]+\/?$)/;

export function isPublicClubRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.test(pathname);
}
