import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { currentAdminSession, onAdminSessionChange } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import type { AdminSession } from "./admin-session";

export type AdminSessionState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; session: AdminSession } | { status: "error"; message: string };

const adminSessionKey = (clubSlug: string) => ["admin-session", clubSlug] as const;

/** Session admin du club : relue à chaque connexion, déconnexion ou expiration. */
export function useAdminSession(clubSlug: string): AdminSessionState & { reload: () => void } {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: adminSessionKey(clubSlug), queryFn: () => currentAdminSession(clubSlug), staleTime: 60_000, retry: false });

  useEffect(
    () =>
      onAdminSessionChange((slug) => {
        if (slug === clubSlug) void queryClient.invalidateQueries({ queryKey: adminSessionKey(clubSlug) });
      }),
    [clubSlug, queryClient],
  );

  const reload = () => void query.refetch();
  if (query.isPending) return { status: "loading", reload };
  if (query.isError) return { status: "error", message: humanMessage(query.error), reload };
  return query.data ? { status: "signed-in", session: query.data, reload } : { status: "signed-out", reload };
}
