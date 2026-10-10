import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { teamLifeApi } from "@/api/endpoints/teamLife";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { Badge, Card, CardSkeletons, ErrorState, ListRow, Screen, SectionHeader } from "@/components/ui";
import { ClubHeader } from "@/features/home/ClubHeader";
import { useRoles } from "@/features/roles/useRoles";

/** Équipes : les miennes d'abord (jouées / coachées), puis tout le club. */
export default function TeamsScreen() {
  const club = useActiveClub();
  const { roles } = useRoles();
  const teams = useQuery({ queryKey: queryKeys.teams(club.clubSlug), queryFn: () => teamLifeApi.teams(club.clubSlug), staleTime: 10 * 60_000 });
  const mineIds = new Set([...roles.coachTeams.map((t) => t.id), ...roles.memberTeams.map((t) => t.id)]);
  const active = (teams.data?.teams ?? []).filter((t) => t.active);
  const mine = active.filter((t) => mineIds.has(t.id));
  const others = active.filter((t) => !mineIds.has(t.id));
  const open = (id: string) => router.push(`/c/${club.clubSlug}/equipes/${id}`);
  return (
    <Screen refreshing={teams.isRefetching} onRefresh={() => void teams.refetch()}>
      <ClubHeader title="Équipes" />
      {teams.isPending ? <CardSkeletons count={2} /> : null}
      {teams.error ? <ErrorState message={humanMessage(teams.error)} onRetry={() => void teams.refetch()} /> : null}
      {mine.length ? (
        <>
          <SectionHeader title="Mes équipes" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {mine.map((t) => (
              <ListRow key={t.id} title={t.name} subtitle={t.category} trailing={roles.coachTeams.some((c) => c.id === t.id) ? <Badge tone="info" label="Coach" /> : undefined} onPress={() => open(t.id)} />
            ))}
          </Card>
        </>
      ) : null}
      {others.length ? (
        <>
          <SectionHeader title="Le club" />
          <Card padded={false} style={{ paddingHorizontal: 16 }}>
            {others.map((t) => (
              <ListRow key={t.id} title={t.name} subtitle={t.category} onPress={() => open(t.id)} />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
