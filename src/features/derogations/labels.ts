import type { DerogationAction, DerogationStatus } from "@/api/endpoints/derogations";
import type { BadgeTone } from "@/components/ui";

export const STATUS: Record<DerogationStatus, { label: string; tone: BadgeTone }> = {
  REQUESTED: { label: "Demandée", tone: "info" },
  IN_PROGRESS: { label: "Prise en charge", tone: "warning" },
  NEEDS_CHANGE: { label: "Autre créneau demandé", tone: "danger" },
  COMPLETED: { label: "Traitée", tone: "success" },
  CANCELLED: { label: "Annulée", tone: "neutral" },
};

export const ACTIONS: Record<DerogationAction, { label: string; needsMessage: boolean; variant: "primary" | "secondary" | "danger" }> = {
  TAKE_IN_CHARGE: { label: "Je m'en occupe", needsMessage: false, variant: "primary" },
  REQUEST_CHANGE: { label: "Pas possible", needsMessage: true, variant: "secondary" },
  COMPLETE: { label: "Marquer comme traitée", needsMessage: false, variant: "primary" },
  CANCEL: { label: "Annuler la demande", needsMessage: false, variant: "danger" },
};
