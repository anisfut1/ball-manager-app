import { router } from "expo-router";
import type { ActionCenterDto } from "@/api/endpoints/teamLife";
import { useActiveClub } from "@/auth/SessionProvider";
import { Badge, Card, ListRow } from "@/components/ui";
import { relativeDayTime } from "@/lib/dates";

/** Prochains événements (matchs FFBB + entraînements) des personnes de l'appareil. */
export function UpcomingList({ events }: { events: ActionCenterDto["upcoming"] }) {
  const club = useActiveClub();
  if (events.length === 0) return null;
  return (
    <Card padded={false} style={{ paddingHorizontal: 16 }}>
      {events.slice(0, 6).map((e) => (
        <ListRow
          key={`${e.kind}:${e.id}`}
          title={e.title}
          subtitle={[relativeDayTime(e.startsAt, club.timezone), e.location, e.forFirstNames.length ? e.forFirstNames.join(", ") : null].filter(Boolean).join(" · ")}
          trailing={e.status === "cancelled" ? <Badge tone="danger" label="Annulé" /> : e.status === "postponed" ? <Badge tone="warning" label="Reporté" /> : undefined}
          onPress={() => router.push(e.kind === "MATCH" ? `/c/${club.clubSlug}/matchs/${e.id}` : `/c/${club.clubSlug}/entrainements/${e.id}`)}
        />
      ))}
    </Card>
  );
}
