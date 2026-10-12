import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card } from "@/components/ui";
import { enablePush, pushPermission } from "@/push/registration";

/**
 * Invitation à activer les notifications, APRÈS connexion et seulement si la
 * permission n'a jamais été demandée. La demande système iOS ne se déclenche
 * qu'au toucher du bouton (jamais au lancement).
 */
export function PushInvite() {
  const { state } = useSession();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void pushPermission().then((p) => setVisible(p === "undetermined"));
  }, []);

  const activate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await enablePush(Object.values(state.clubs));
      if (result !== "undetermined") setVisible(false);
    } catch {
      setError("Impossible d'activer les notifications pour le moment.");
    } finally {
      setBusy(false);
    }
  }, [state.clubs]);

  if (!visible) return null;
  return (
    <Card>
      <AppText variant="headline">Ne manque aucune convocation</AppText>
      <AppText variant="callout" tone="muted">
        Recevez vos convocations et changements de match.
      </AppText>
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label="Activer les notifications" loading={busy} onPress={() => void activate()} fullWidth />
      <Button label="Plus tard" variant="ghost" onPress={() => setVisible(false)} />
    </Card>
  );
}
