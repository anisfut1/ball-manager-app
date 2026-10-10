import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, CardSkeletons, ListRow, Sheet, type BadgeTone } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  CONFIRMED: { label: "Convocation confirmée", tone: "success" },
  CONVOKED: { label: "Convoqué·e", tone: "info" },
  AVAILABLE: { label: "Disponible", tone: "success" },
  UNCERTAIN: { label: "Incertain·e", tone: "warning" },
  NO_RESPONSE: { label: "Sans réponse", tone: "neutral" },
  NOT_CONVOKED: { label: "Non convoqué·e", tone: "neutral" },
  DECLINED: { label: "Ne vient pas", tone: "danger" },
  UNAVAILABLE: { label: "Indisponible", tone: "danger" },
};

/**
 * Lavage des maillots : suggestions équitables (moins de lavages cette
 * saison d'abord), le COACH choisit — jamais d'attribution automatique.
 */
export function LaundrySheet({ visible, onClose, matchId, as }: { visible: boolean; onClose: () => void; matchId: string; as: string }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const suggestions = useQuery({ queryKey: queryKeys.laundrySuggestions(club.clubSlug, matchId), queryFn: () => teamLifeApi.laundrySuggestions(club.clubSlug, as, matchId), enabled: visible });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.matchTeamLife(club.clubSlug, matchId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
  };
  const assign = useMutation({ mutationFn: (licencieId: string) => teamLifeApi.assignLaundry(club.clubSlug, as, matchId, licencieId), onSuccess: () => (invalidate(), onClose()) });
  return (
    <Sheet visible={visible} title="Lavage des maillots" onClose={onClose}>
      <AppText variant="callout" tone="muted">
        Suggestions : qui a le moins lavé cette saison, parmi les présents. C&apos;est toi qui choisis.
      </AppText>
      {assign.error ? <Banner tone="danger" message={humanMessage(assign.error)} /> : null}
      {suggestions.isPending ? <CardSkeletons count={2} /> : null}
      {suggestions.error ? <Banner tone="danger" message={humanMessage(suggestions.error)} /> : null}
      {(suggestions.data?.candidates ?? []).map((c) => (
        <ListRow
          key={c.licencie.id}
          title={c.label}
          subtitle={`${c.seasonCount} lavage${c.seasonCount > 1 ? "s" : ""} cette saison${c.repeat ? " · a lavé au match précédent" : ""}`}
          leading={c.suggested ? <Badge tone="success" label="Suggéré" /> : undefined}
          trailing={<Badge tone={STATUS[c.status]?.tone ?? "neutral"} label={STATUS[c.status]?.label ?? c.status} />}
          onPress={() => assign.mutate(c.licencie.id)}
        />
      ))}
      <Button label="Fermer" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}
