import { useState } from "react";
import { router } from "expo-router";
import { Button, Card, TextField } from "@/components/ui";
import { internalPathFor, resolveDestination } from "@/linking/resolveDestination";

/** Lien Ball Manager collé à la main : même résolveur que les Universal Links. */
export function PasteLink() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  function open() {
    const destination = resolveDestination(value.trim());
    const path = internalPathFor(destination);
    if (!path || destination.kind === "home") return setError("Colle le lien reçu par email (il commence par https://www.ball-manager.fr/).");
    setError(null);
    router.push(path);
  }
  return (
    <Card>
      <TextField label="J'ai reçu un lien Ball Manager" value={value} onChangeText={setValue} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://www.ball-manager.fr/public/…" error={error} />
      <Button label="Ouvrir ce lien" variant="secondary" disabled={!value.trim()} onPress={open} fullWidth />
    </Card>
  );
}
