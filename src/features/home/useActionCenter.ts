import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { queryKeys } from "@/api/queryKeys";
import { humanMessage } from "@/api/errors";
import { teamLifeApi, type ActionCenterDto } from "@/api/endpoints/teamLife";
import { useActiveClub } from "@/auth/SessionProvider";
import { applyAnswer, type OptimisticAnswer } from "./action-center-model";

/** Action Center du club actif, pour TOUTES les personnes de l'appareil. */
export function useActionCenter() {
  const club = useActiveClub();
  const people = club.people.map((p) => p.licencieId);
  const query = useQuery({ queryKey: queryKeys.actionCenter(club.clubSlug, people), queryFn: () => teamLifeApi.actionCenter(club.clubSlug, people), enabled: people.length > 0 });
  return { club, people, query };
}

/**
 * Réponse en un geste : mise à jour optimiste immédiate, retour en arrière
 * et message clair si le serveur refuse (jamais de faux succès).
 */
export function useAnswer() {
  const { club, people } = useActionCenter();
  const queryClient = useQueryClient();
  const key = queryKeys.actionCenter(club.clubSlug, people);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation<void, unknown, OptimisticAnswer, { previous?: ActionCenterDto }>({
    mutationFn: async (answer) => {
      const slug = club.clubSlug;
      switch (answer.kind) {
        case "training":
          await teamLifeApi.respondTraining(slug, answer.licencieId, answer.occurrenceId, answer.response);
          return;
        case "availability":
          await teamLifeApi.respondAvailability(slug, answer.licencieId, answer.matchId, answer.response);
          return;
        case "convocation":
          await teamLifeApi.respondConvocation(slug, answer.licencieId, answer.matchId, answer.response);
          return;
        case "laundry-seen":
          await teamLifeApi.laundrySeen(slug, answer.licencieId, answer.matchId);
          return;
      }
    },
    onMutate: async (answer) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ActionCenterDto>(key);
      if (previous) queryClient.setQueryData(key, applyAnswer(previous, answer));
      return { previous };
    },
    onError: (e, _answer, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      setError(humanMessage(e));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    },
    onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.planningAll(club.clubSlug) });
    },
  });
  return { answer: mutation.mutate, pending: mutation.isPending, error, clearError: () => setError(null) };
}
