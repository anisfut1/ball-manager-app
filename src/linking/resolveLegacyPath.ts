import type { NormalizedUrl } from "./normalizeIncomingUrl";
import { ID, SLUG } from "./validateDomain";

/**
 * Chemins du web (ball-manager-web, générés par BallManagerLinkService côté
 * back) → écrans de l'app. Tous les liens déjà envoyés par email restent
 * valides : `/public/{slug}/…` (espace public, liens personnels),
 * `/public/{slug}/connexion/code/{code}` (lien de connexion à usage unique),
 * `/c/{slug}/…` (espace club par compte).
 */
export type AppRoute = string;

export type Destination =
  /** Écran de l'app pour ce club (session requise ; changement de club automatique si autorisé). */
  | { kind: "route"; clubSlug: string; route: AppRoute }
  /** Lien personnel (`?token=` / `#token=`) : l'échanger contre une session, puis ouvrir `then`. Jamais conservé. */
  | { kind: "bootstrap"; clubSlug: string; token: string; then: AppRoute }
  /** Lien de connexion à usage unique. */
  | { kind: "login-code"; clubSlug: string; code: string }
  /** Fonction web uniquement : ouverte dans le navigateur, assumé comme tel. */
  | { kind: "web-only"; url: string; reason: string }
  | { kind: "home" }
  | { kind: "reject"; reason: "invalid-domain" | "malformed" };

const club = (slug: string) => `/c/${slug}`;

/** Écran mobile d'une section de l'espace public. */
function publicRoute(slug: string, segments: string[], url: NormalizedUrl): AppRoute {
  const [section, id, sub] = segments;
  const hash = url.hash;
  switch (section) {
    case undefined:
    case "accueil":
    case "connexion": {
      // Accueil avec ancre de séance (`#seance-<id>`, notification « entraînement annulé »).
      const seance = /^seance-([A-Za-z0-9-]{1,64})$/.exec(hash)?.[1];
      return seance ? `${club(slug)}/entrainements/${seance}` : club(slug);
    }
    case "planning":
      return `${club(slug)}/planning`;
    case "matchs":
    case "resultats":
      if (id && ID.test(id)) {
        const section = hash === "convocation" ? "convocation" : hash === "vie-equipe" ? "coach" : null;
        return section ? `${club(slug)}/matchs/${id}?section=${section}` : `${club(slug)}/matchs/${id}`;
      }
      return `${club(slug)}/${section}`;
    case "entrainements": {
      const seance = url.query.get("seance");
      if (seance && ID.test(seance)) return `${club(slug)}/entrainements/${seance}`;
      const equipe = url.query.get("equipe");
      return equipe && ID.test(equipe) ? `${club(slug)}/equipes/${equipe}?tab=planning` : `${club(slug)}/planning`;
    }
    case "equipes":
      return id && ID.test(id) ? `${club(slug)}/equipes/${id}` : "/equipes";
    case "derogations":
      return id && ID.test(id) && !sub ? `${club(slug)}/derogations/${id}` : `${club(slug)}/derogations`;
    case "tables":
      return `${club(slug)}/tables`;
    case "compte":
      return "/profil";
    default:
      return club(slug);
  }
}

function tokenOf(url: NormalizedUrl): string | null {
  const fromHash = new URLSearchParams(url.hash).get("token");
  const token = fromHash || url.query.get("token");
  return token && token.length >= 8 && token.length <= 512 ? token : null;
}

export function resolveLegacyPath(url: NormalizedUrl): Destination {
  const [root, slug, ...rest] = url.segments;

  if (root === "public") {
    if (!slug || !SLUG.test(slug)) return { kind: "home" };
    const [section, a, b] = rest;
    if (section === "connexion" && a === "code" && b && /^[A-Za-z0-9_-]{20,128}$/.test(b)) return { kind: "login-code", clubSlug: slug, code: b };
    // Routes techniques du site (exclues de l'AASA) : jamais un écran.
    if (section === "session" || section === "auth" || section === "manifest.webmanifest") return { kind: "route", clubSlug: slug, route: club(slug) };
    const route = publicRoute(slug, rest, url);
    const token = tokenOf(url);
    return token ? { kind: "bootstrap", clubSlug: slug, token, then: route } : { kind: "route", clubSlug: slug, route };
  }

  if (root === "c" && slug && SLUG.test(slug)) {
    const [section, id] = rest;
    // Espace club par compte : les écrans équivalents de l'app quand ils existent.
    if (section === "matchs" && id && ID.test(id)) return { kind: "route", clubSlug: slug, route: `${club(slug)}/matchs/${id}` };
    if (section === "equipes" && id && ID.test(id)) return { kind: "route", clubSlug: slug, route: `${club(slug)}/equipes/${id}` };
    if (section === "derogations") return { kind: "route", clubSlug: slug, route: `${club(slug)}/derogations` };
    if (section === "tables") return { kind: "route", clubSlug: slug, route: `${club(slug)}/tables` };
    if (section === "planning" || section === "entrainements") return { kind: "route", clubSlug: slug, route: `${club(slug)}/planning` };
    // Administration (intégrations FFBB/FBI, imports, synchro…) : web uniquement.
    return { kind: "web-only", url: `${url.webOrigin ?? "https://www.ball-manager.fr"}${url.path}`, reason: "Administration du club : disponible sur le site." };
  }

  if (root === "platform" || root === "login" || root === "bienvenue" || root === "mot-de-passe-oublie") {
    return { kind: "web-only", url: `${url.webOrigin ?? "https://www.ball-manager.fr"}${url.path}${url.query.toString() ? `?${url.query.toString()}` : ""}`, reason: "Espace par compte : disponible sur le site." };
  }

  return { kind: "home" };
}
