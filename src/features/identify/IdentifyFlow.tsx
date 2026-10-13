import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, humanMessage } from "@/api/errors";
import { identifyApi, type LicencieMatch } from "@/api/endpoints/identify";
import { AppText, Avatar, Banner, Button, Card, ListRow, TextField, type BannerTone } from "@/components/ui";
import { colors, spacing } from "@/design";
import { NAME_SEARCH_DEBOUNCE_MS, searchableNameQuery } from "./name-query";

type Step = { kind: "search" } | { kind: "confirm"; licencie: LicencieMatch; needsEmail: boolean } | { kind: "sent"; firstName: string; maskedEmail: string } | { kind: "pending"; firstName: string } | { kind: "request" } | { kind: "request-sent" };

/**
 * Parcours « Recevoir un lien de connexion » (même règles que le web) :
 * prénom + nom → au plus 5 fiches (prénom + initiale) → lien envoyé à
 * l'adresse connue du club (masquée). Le lien n'est JAMAIS affiché ici.
 */
export function IdentifyFlow({ clubSlug }: { clubSlug: string }) {
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: BannerTone; text: string } | null>(null);

  const searchable = searchableNameQuery(query);
  // Recherche au fil de la frappe : une requête par nom stable (limite serveur : 30/min).
  const [found, setFound] = useState<{ q: string; list: LicencieMatch[] | null; error: string | null } | null>(null);
  const current = found && found.q === searchable ? found : null;
  const results = current?.list ?? null;
  const searching = !!searchable && !current;
  useEffect(() => {
    if (!searchable) return;
    let alive = true;
    const timer = setTimeout(() => {
      identifyApi
        .search(clubSlug, searchable)
        .then((list) => alive && setFound({ q: searchable, list, error: null }))
        .catch((error: unknown) => alive && setFound({ q: searchable, list: null, error: humanMessage(error) }));
    }, NAME_SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [clubSlug, searchable]);

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
    <View style={styles.search}>
      <TextField
        label="Ton prénom et ton nom (ou ceux de ton enfant)"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        placeholder="Léa Martin"
        textContentType="name"
      />
      {banner}
      {current?.error ? <Banner tone="danger" message={current.error} /> : null}
      {!searchable ? (
        <View style={styles.hint}>
          <Ionicons name="sparkles-outline" size={16} color={colors.subtle} />
          <AppText variant="meta" tone="muted" style={styles.flex}>
            Tape ton prénom puis ton nom : les fiches du club s&apos;affichent au fil de la frappe.
          </AppText>
        </View>
      ) : null}
      {searchable && searching && !results ? <ActivityIndicator color={colors.subtle} style={styles.spinner} /> : null}
      {searchable && results ? (
        results.length ? (
          <Card padded={false} style={styles.results}>
            {results.map((l, i) => (
              <View key={l.id}>
                {i ? <View style={styles.separator} /> : null}
                <ListRow
                  title={`${l.firstName} ${l.lastInitial}.`}
                  subtitle="C'est moi"
                  leading={<Avatar firstName={l.firstName} lastName={l.lastInitial} size={40} />}
                  onPress={() => setStep({ kind: "confirm", licencie: l, needsEmail: false })}
                  accessibilityHint="Recevoir mon lien de connexion"
                />
              </View>
            ))}
          </Card>
        ) : searching ? (
          <ActivityIndicator color={colors.subtle} style={styles.spinner} />
        ) : (
          <Card>
            <AppText variant="headline">Personne de ce nom au club</AppText>
            <AppText variant="callout" tone="muted">
              Vérifie l&apos;orthographe, ou demande au club de t&apos;ajouter.
            </AppText>
            <Button label="Demander un accès au club" variant="secondary" onPress={() => setStep({ kind: "request" })} fullWidth />
          </Card>
        )
      ) : null}
      <View style={styles.hint}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.subtle} />
        <AppText variant="meta" tone="subtle" style={styles.flex}>
          Pour protéger les licenciés, seuls le prénom et l&apos;initiale du nom s&apos;affichent. Ton lien de connexion part à l&apos;adresse connue du club.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { gap: spacing.md },
  hint: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" },
  flex: { flex: 1 },
  spinner: { alignSelf: "center", paddingVertical: spacing.md },
  results: { paddingHorizontal: spacing.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
