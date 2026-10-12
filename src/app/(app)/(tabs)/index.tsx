import { useMemo } from "react";
import { humanMessage } from "@/api/errors";
import { AppText, Banner, CardSkeletons, EmptyState, ErrorState, Screen, SectionHeader } from "@/components/ui";
import { ActionItem } from "@/features/home/ActionCards";
import { ClubHeader } from "@/features/home/ClubHeader";
import { PushInvite } from "@/features/home/PushInvite";
import { UpcomingList } from "@/features/home/UpcomingList";
import { actionKey, isPending, sortActions } from "@/features/home/action-center-model";
import { useActionCenter, useAnswer } from "@/features/home/useActionCenter";

/**
 * Accueil = Action Center. « J'ouvre. Je vois ce que je dois faire. Je
 * touche. C'est terminé. » Réponses directement ici, sans naviguer.
 */
export default function HomeScreen() {
  const { query } = useActionCenter();
  const { answer, pending, error, clearError } = useAnswer();
  const actions = useMemo(() => sortActions(query.data?.actions ?? []), [query.data]);
  const todo = actions.filter(isPending).length;

  return (
    <Screen refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
      <ClubHeader title="Accueil" />
      <PushInvite />
      {error ? <Banner tone="danger" message={error} /> : null}
      {query.isPending ? <CardSkeletons count={3} /> : null}
      {query.error && !query.data ? <ErrorState message={humanMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.error && query.data ? <Banner tone="warning" message="Données peut-être pas à jour : connexion indisponible." /> : null}
      {query.data ? (
        <>
          <SectionHeader title={todo > 0 ? `À faire · ${todo}` : "À faire"} />
          {actions.length === 0 ? <EmptyState title="Rien à faire pour l'instant" message="Les réponses attendues (entraînements, matchs, convocations) apparaîtront ici." /> : null}
          {actions.map((a) => (
            <ActionItem
              key={actionKey(a)}
              action={a}
              disabled={pending}
              answer={(x) => {
                clearError();
                answer(x);
              }}
            />
          ))}
          {query.data.upcoming.length ? <SectionHeader title="À venir" /> : null}
          <UpcomingList events={query.data.upcoming} />
          {query.data.invalidTokenIndexes.length ? <AppText variant="meta" tone="subtle">Une personne de cet appareil n&apos;est plus accessible (lien renouvelé par le club).</AppText> : null}
        </>
      ) : null}
    </Screen>
  );
}
