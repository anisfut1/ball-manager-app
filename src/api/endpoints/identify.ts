import { api, call } from "../client";
import type { Dto } from "../types";

export type LicencieMatch = Dto<"LicencieSearchResultDto">["licencies"][number];
export type LinkTarget = Dto<"PublicLinkTarget">;

/** « Recevoir un lien de connexion » : nom → fiche → lien envoyé par email (jamais affiché). */
export const identifyApi = {
  search: (clubSlug: string, q: string) => call(null, () => api().POST("/v1/public/clubs/{clubSlug}/licencies/search", { params: { path: { clubSlug } }, body: { q } })).then((r) => r.licencies),
  requestLink: (clubSlug: string, licencieId: string, body: { email: string | null; returnTo?: LinkTarget }) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/licencies/{licencieId}/request-link", { params: { path: { clubSlug, licencieId } }, body })),
  accessRequest: (clubSlug: string, body: { fullName: string; email: string; message?: string }) =>
    call(null, () => api().POST("/v1/public/clubs/{clubSlug}/access-requests", { params: { path: { clubSlug } }, body })),
};
