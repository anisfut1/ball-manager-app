import { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useSession } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, Sheet } from "@/components/ui";
import { humanMessage } from "@/api/errors";

const DELETED = ["Ton accès au club, sur cet iPhone et sur tous tes autres appareils (et sur le web)", "Ton e-mail, ton téléphone et ta photo", "Tes rôles dans le club (coach, tables, dérogations…)"];
const KEPT = ["La fiche sportive gérée par le club", "Ton nom et ton numéro de licence, pour les feuilles de match et les historiques"];

/**
 * « Supprimer mon compte » (guideline Apple 5.1.1(v)) : bouton du profil + confirmation.
 * Supprime l'accès sur TOUS les clubs de l'appareil, un club après l'autre.
 */
export function DeleteAccountSection() {
  const { state, deleteAccount } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failedClubs, setFailedClubs] = useState<string[]>([]);
  const [unexpected, setUnexpected] = useState<string | null>(null);
  const running = useRef(false);
  const clubs = Object.values(state.clubs);

  const confirm = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailedClubs([]);
    setUnexpected(null);
    try {
      const outcome = await deleteAccount();
      if (outcome.failed.length === 0) setOpen(false);
      else setFailedClubs(outcome.failed.map((c) => c.clubName));
    } catch (error) {
      setUnexpected(humanMessage(error));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [deleteAccount]);

  return (
    <>
      <Button label="Supprimer mon compte" variant="danger" onPress={() => setOpen(true)} fullWidth accessibilityHint="Ouvre une confirmation avant toute suppression" />
      <Sheet visible={open} title="Supprimer mon compte" onClose={() => (busy ? undefined : setOpen(false))} focusTitle>
        <AppText variant="body">Cette action est définitive. Ton compte sera supprimé sur cet iPhone et sur tous tes autres appareils.</AppText>

        <AppText variant="headline" accessibilityRole="header">
          Profils concernés
        </AppText>
        <Card>
          {clubs.map((c) => (
            <View key={c.clubSlug}>
              <AppText variant="bodyStrong">{c.clubName}</AppText>
              {c.people.map((p) => (
                <AppText key={p.licencieId} variant="callout" tone="muted">
                  {p.firstName}
                </AppText>
              ))}
            </View>
          ))}
        </Card>

        <AppText variant="headline" accessibilityRole="header">
          Supprimé
        </AppText>
        {DELETED.map((line) => (
          <AppText key={line} variant="callout">{`• ${line}`}</AppText>
        ))}

        <AppText variant="headline" accessibilityRole="header">
          Conservé
        </AppText>
        {KEPT.map((line) => (
          <AppText key={line} variant="callout">{`• ${line}`}</AppText>
        ))}

        <Banner tone="warning" message="Si un autre parent a accès à ces enfants avec le même lien, son accès sera aussi coupé." />

        {failedClubs.length > 0 ? (
          <Banner tone="danger" message={`Le compte n'a pas pu être supprimé pour : ${failedClubs.join(", ")}. Vérifie ta connexion puis réessaie.`} />
        ) : null}
        {unexpected ? <Banner tone="danger" message={unexpected} /> : null}

        <Button label="Supprimer définitivement" variant="danger" loading={busy} onPress={() => void confirm()} fullWidth />
        <Button label="Annuler" variant="secondary" disabled={busy} onPress={() => setOpen(false)} fullWidth />
      </Sheet>
    </>
  );
}
