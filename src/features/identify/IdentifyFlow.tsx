import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiError, humanMessage } from "@/api/errors";
import { identifyApi, type LicencieMatch } from "@/api/endpoints/identify";
import { AppText, Banner, Button, Card, ListRow, TextField, type BannerTone } from "@/components/ui";
import { spacing } from "@/design";

type Step = { kind: "search" } | { kind: "confirm"; licencie: LicencieMatch; needsEmail: boolean } | { kind: "sent"; firstName: string; maskedEmail: string } | { kind: "pending"; firstName: string } | { kind: "request" } | { kind: "request-sent" };

/**
 * Parcours « Recevoir un lien de connexion » (même règles que le web) :
 * prénom + nom → au plus 5 fiches (prénom + initiale) → lien envoyé à
 * l'adresse connue du club (masquée). Le lien n'est JAMAIS affiché ici.
 */
export function IdentifyFlow({ clubSlug }: { clubSlug: string }) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LicencieMatch[] | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: BannerTone; text: string } | null>(null);

  async function search() {
    if (query.trim().split(/\s+/).length < 2) return setFeedback({ tone: "info", text: "Tape ton prénom et ton nom, par exemple « Léa Martin »." });
    setBusy(true);
    setFeedback(null);
    try {
      setResults(await identifyApi.search(clubSlug, query.trim()));
    } catch (error) {
      setFeedback({ tone: "danger", text: humanMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function send(current: Extract<Step, { kind: "confirm" }>) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await identifyApi.requestLink(clubSlug, current.licencie.id, { email: current.needsEmail ? email.trim() : null });
      if (result.pendingApproval || !result.maskedEmail) setStep({ kind: "pending", firstName: current.licencie.firstName });
      else setStep({ kind: "sent", firstName: current.licencie.firstName, maskedEmail: result.maskedEmail });
    } catch (error) {
      if (error instanceof ApiError && error.code === "EMAIL_REQUIRED") {
        if (current.needsEmail) setFeedback({ tone: "danger", text: error.message });
        setStep({ ...current, needsEmail: true });
      } else {
        setFeedback({ tone: error instanceof ApiError && error.code === "LINK_RECENTLY_SENT" ? "info" : "danger", text: humanMessage(error) });
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendAccessRequest() {
    setBusy(true);
    setFeedback(null);
    try {
      await identifyApi.accessRequest(clubSlug, { fullName: query.trim(), email: email.trim(), message: message.trim() || undefined });
      setStep({ kind: "request-sent" });
    } catch (error) {
      setFeedback({ tone: "danger", text: humanMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const banner = feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null;

  if (step.kind === "sent") {
    return (
      <Card>
        <AppText variant="headline">Lien envoyé, {step.firstName} !</AppText>
        <AppText variant="callout" tone="muted">
          Un email vient de partir à {step.maskedEmail}. Ouvre-le sur cet iPhone : Ball Manager s&apos;ouvrira directement, connecté.
        </AppText>
        <Banner tone="warning" message="Pas reçu ? Regarde dans tes indésirables (spams)." />
        <Button label="Ce n'est pas moi" variant="ghost" onPress={() => setStep({ kind: "search" })} />
      </Card>
    );
  }
  if (step.kind === "pending") {
    return (
      <Card>
        <AppText variant="headline">Demande transmise</AppText>
        <AppText variant="callout" tone="muted">
          Le club n&apos;a pas encore d&apos;adresse pour {step.firstName} : un responsable valide la demande, puis le lien arrive par email.
        </AppText>
      </Card>
    );
  }
  if (step.kind === "request-sent") {
    return (
      <Card>
        <AppText variant="headline">Demande envoyée au club</AppText>
        <AppText variant="callout" tone="muted">
          Un responsable te répondra par email.
        </AppText>
      </Card>
    );
  }
  if (step.kind === "confirm") {
    return (
      <Card>
        <AppText variant="headline">
          C&apos;est bien {step.licencie.firstName} {step.licencie.lastInitial}. ?
        </AppText>
        {step.needsEmail ? <TextField label="Ton adresse email" hint="Le club la vérifiera avant l'envoi du lien." value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" /> : null}
        {banner}
        <Button label="Recevoir mon lien par email" loading={busy} onPress={() => void send(step)} fullWidth />
        <Button label="Ce n'est pas moi" variant="ghost" onPress={() => setStep({ kind: "search" })} />
      </Card>
    );
  }
  if (step.kind === "request") {
    return (
      <Card>
        <AppText variant="headline">Demander un accès au club</AppText>
        <TextField label="Ton email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <TextField label="Message (facultatif)" value={message} onChangeText={setMessage} multiline />
        {banner}
        <Button label="Envoyer la demande" loading={busy} disabled={!email.trim()} onPress={() => void sendAccessRequest()} fullWidth />
        <Button label="Retour" variant="ghost" onPress={() => setStep({ kind: "search" })} />
      </Card>
    );
  }
  return (
    <Card>
      <TextField label="Ton prénom et ton nom (ou ceux de ton enfant)" value={query} onChangeText={setQuery} autoCapitalize="words" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => void search()} placeholder="Léa Martin" />
      {banner}
      <Button label="Rechercher" loading={busy} onPress={() => void search()} fullWidth />
      {results ? (
        results.length ? (
          <View style={styles.list}>
            {results.map((l) => (
              <ListRow key={l.id} title={`${l.firstName} ${l.lastInitial}.`} onPress={() => setStep({ kind: "confirm", licencie: l, needsEmail: false })} />
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            <AppText variant="callout" tone="muted">
              Personne de ce nom au club.
            </AppText>
            <Button label="Demander un accès au club" variant="secondary" onPress={() => setStep({ kind: "request" })} />
          </View>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({ list: { gap: spacing.xs } });
