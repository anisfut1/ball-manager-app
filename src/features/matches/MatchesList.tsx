import { useMemo, useState } from "react";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { clubSpaceApi } from "@/api/endpoints/clubSpace";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { CardSkeletons, EmptyState, ErrorState, SegmentedControl } from "@/components/ui";
import { useRoles } from "@/features/roles/useRoles";
import { DayGroups } from "./DayGroups";
import { MatchCard } from "./MatchCard";
import { groupByDay } from "./match-model";
import { useClubInfo } from "./useClubInfo";

type Scope = "MINE" | "CLUB";

/**
 * Matchs du club (FFBB), comme les pages « Matchs » et « Résultats » du web :
 * à venir dans l'ordre chronologique, ou résultats du plus récent au plus
 * ancien, regroupés par jour. « Mes équipes » filtre sur les équipes de
 * l'appareil (joueur ou coach).
 */
export function MatchesList({ period }: { period: "upcoming" | "past" }) {
  const club = useClubInfo();
  const { roles } = useRoles();
  // La liste des matchs n'expose que le nom d'équipe : filtre par nom (équipes de l'appareil, joueur ou coach).
  const myTeams = useMemo(() => new Set([...roles.memberTeams.map((t) => t.name), ...roles.coachTeams.map((t) => t.name)]), [roles]);
  const [scope, setScope] = useState<Scope>("MINE");
  const query = useQuery({ queryKey: queryKeys.matches(club.slug, period), queryFn: () => clubSpaceApi.matches(club.slug, { period, limit: 60 }) });
  const effectiveScope: Scope = myTeams.size ? scope : "CLUB";
  const matches = useMemo(() => {
    const all = query.data ?? [];
    const list = effectiveScope === "MINE" ? all.filter((m) => myTeams.has(m.teamName ?? "")) : all;
    return period === "past" ? [...list].sort((a, b) => (b.matchDatetime ?? "").localeCompare(a.matchDatetime ?? "")) : list;
  }, [query.data, effectiveScope, myTeams, period]);

  return (
    <>
      {myTeams.size ? (
        <SegmentedControl
          options={[
            { value: "MINE", label: "Mes équipes" },
            { value: "CLUB", label: "Tout le club" },
          ]}
          value={scope}
          onChange={setScope}
        />
      ) : null}
      {query.isPending ? <CardSkeletons count={3} /> : null}
      {query.error ? <ErrorState message={humanMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data && matches.length === 0 ? (
        <EmptyState
          icon={period === "past" ? "trophy-outline" : "calendar-outline"}
          title={period === "past" ? "Pas encore de résultat" : "Aucun match à venir"}
          message={period === "past" ? "Les scores apparaissent ici dès leur publication par la FFBB." : "Les prochains matchs publiés par la FFBB apparaîtront ici."}
        />
      ) : null}
      {matches.length ? (
        <DayGroups
          groups={groupByDay(matches, (m) => m.matchDatetime)}
          itemKey={(m) => m.id}
          render={(m) => <MatchCard match={m} club={club} onPress={() => router.push(`/c/${club.slug}/matchs/${m.id}`)} />}
        />
      ) : null}
    </>
  );
}
