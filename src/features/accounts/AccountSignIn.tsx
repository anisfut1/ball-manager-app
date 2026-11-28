import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/auth/SessionProvider";
import { Banner, Button, Card } from "@/components/ui";
import { spacing } from "@/design";
import { destinationAfterLogin } from "@/navigation/after-login";
import { AccountAuthForm } from "./AccountAuthForm";

/** « Déjà un compte ? Se connecter » sous la recherche du nom. */
export function AccountSignIn({ clubSlug }: { clubSlug: string }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!open) return <Button label="Déjà un compte ? Se connecter" variant="secondary" onPress={() => setOpen(true)} />;

  return (
    <Card style={styles.card}>
      <AccountAuthForm
        initialMode="sign-in"
        onAuthenticated={async (dto) => {
          const result = await session.accountLogin(clubSlug, dto);
          if (result.active > 0) {
            router.replace(destinationAfterLogin(clubSlug, null));
            return;
          }
          setNotice(result.pending > 0 ? "Ta demande attend la validation du club : tu y auras accès dès qu'un responsable accepte." : "Ton compte ne suit encore personne dans ce club : retrouve ton nom ci-dessus.");
        }}
      />
      {notice ? <Banner tone="info" message={notice} /> : null}
      <View>
        <Button label="Fermer" variant="ghost" onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ card: { gap: spacing.md } });
