import type { Ionicons } from "@expo/vector-icons";

/**
 * Espaces réservés aux licenciés : une seule porte d'entrée
 * (`LicensedAccessGate`), chaque module n'apporte que son contexte (même
 * configuration que ball-manager-web, src/features/licensed-access/modules.ts).
 */
export type LicensedAccessModuleId = "home" | "team" | "planning" | "tables" | "derogations";

export interface LicensedAccessModule {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  audience?: string;
}

export const licensedAccessModules: Record<LicensedAccessModuleId, LicensedAccessModule> = {
  home: { title: "Mon espace", description: "Ton équipe, tes prochains matchs et tes tables de marque au même endroit.", icon: "home-outline" },
  team: { title: "Mon équipe", description: "Le prochain match, les entraînements et l'effectif de ton équipe.", icon: "shirt-outline" },
  planning: { title: "Planning", description: "Les matchs et entraînements de ton équipe — ou de tes enfants — semaine par semaine.", icon: "calendar-outline" },
  tables: { title: "Tables de marque", description: "Positionne-toi sur les rencontres à domicile et retrouve tes affectations.", icon: "clipboard-outline" },
  derogations: {
    title: "Dérogations",
    description: "Consulte et suis les demandes de dérogation liées aux rencontres de tes équipes.",
    icon: "swap-horizontal-outline",
    audience: "Coachs, coordinateur et administrateurs",
  },
};

/** Module d'après la page demandée avant la connexion (lien de convocation, onglet Tables…). */
export function moduleForRoute(route: string | null | undefined): LicensedAccessModuleId {
  if (!route) return "home";
  if (/\/tables\b/.test(route)) return "tables";
  if (/\/derogations\b/.test(route)) return "derogations";
  if (/\/(equipe|equipes)\b/.test(route)) return "team";
  if (/\/(planning|entrainements)\b/.test(route)) return "planning";
  return "home";
}
