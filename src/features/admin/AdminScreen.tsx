import type { ReactNode } from "react";
import { Stack } from "expo-router";
import type { AdminSession } from "./admin-session";
import { useActiveClub } from "@/auth/SessionProvider";
import { CardSkeletons, ErrorState, Screen } from "@/components/ui";
import { colors } from "@/design";
import { AdminLogin } from "./AdminLogin";
import { useAdminSession } from "./useAdminSession";
import { ClubHeader } from "@/features/home/ClubHeader";

/**
 * Écran de l'espace d'administration (2026-10-22) : réservé aux comptes
 * administrateurs du club sur le site. Sans session admin : la connexion par
 * compte à la place du contenu ; le serveur revérifie le rôle à chaque appel.
 */
export function AdminScreen({ title, onRefresh, children }: { title: string; onRefresh?: () => void; children: (session: AdminSession) => ReactNode }) {
  const club = useActiveClub();
  const admin = useAdminSession(club.clubSlug);
  return (
    <Screen edges={[]} refreshing={false} onRefresh={admin.status === "signed-in" ? onRefresh : undefined}>
      <Stack.Screen options={{ headerShown: true, title: "", headerBackTitle: "Retour", headerShadowVisible: false, headerStyle: { backgroundColor: colors.background } }} />
      <ClubHeader title={title} />
      {admin.status === "signed-in" ? (
        children(admin.session)
      ) : admin.status === "loading" ? (
        <CardSkeletons count={2} />
      ) : admin.status === "error" ? (
        <ErrorState message={admin.message} onRetry={admin.reload} />
      ) : (
        <AdminLogin clubSlug={club.clubSlug} clubName={club.clubName} />
      )}
    </Screen>
  );
}
