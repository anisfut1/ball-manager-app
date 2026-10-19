import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ApiError, humanMessage } from "@/api/errors";
import { identifyApi, type LicencieMatch } from "@/api/endpoints/identify";
import { AppText, Avatar, Banner, Button, Skeleton, TextField, type BannerTone } from "@/components/ui";
import { colors, MAX_FONT_SCALE, radius, shadows, spacing, typography } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { NAME_SEARCH_DEBOUNCE_MS, searchableNameQuery } from "@/features/identify/name-query";
import { LicensedLinkPending, LicensedLinkSent, LicensedRequestSent } from "./LicensedAccessSuccess";

type Step = { kind: "search" } | { kind: "confirm"; licencie: LicencieMatch; needsEmail: boolean } | { kind: "sent"; firstName: string; maskedEmail: string } | { kind: "pending"; firstName: string } | { kind: "request" } | { kind: "request-sent" };

const displayName = (l: LicencieMatch) => `${l.firstName} ${l.lastInitial}.`;

/** Panne ou réseau : jamais de message technique ; un refus explicite du serveur (4xx) reste lisible. */
function searchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return humanMessage(error);
  return "Impossible d'effectuer la recherche pour le moment.";
}

/**
 * Cœur de l'accès licencié (mêmes règles que le web) : prénom + nom, au fil
 * de la frappe (une requête par nom stable, limite serveur 30/min) → au plus
 * 5 fiches (prénom + initiale) → lien envoyé à l'adresse connue du club
 * (masquée). Le lien n'est JAMAIS affiché ici.
 *
 * `variant="bare"` : sans carte (feuille « Ajouter un enfant »).
 */
export function LicensedSearchCard({ clubSlug, variant = "card", autoFocus = true }: { clubSlug: string; variant?: "card" | "bare"; autoFocus?: boolean }) {
  const accent = useClubAccent();
  const [step, setStep] = useState<Step>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: BannerTone; text: string } | null>(null);
  const [retry, setRetry] = useState(0);

  const searchable = searchableNameQuery(query);
  const [found, setFound] = useState<{ key: string; list: LicencieMatch[] | null; error: string | null } | null>(null);
  const key = searchable ? `${searchable}#${retry}` : null;
  const current = found && found.key === key ? found : null;
  const results = current?.list ?? null;
  const searching = !!searchable && !current;
  useEffect(() => {
    if (!searchable || !key) return;
    let alive = true;
    const timer = setTimeout(() => {
      identifyApi
        .search(clubSlug, searchable)
        .then((list) => alive && setFound({ key, list, error: null }))
        .catch((error: unknown) => alive && setFound({ key, list: null, error: searchErrorMessage(error) }));
    }, NAME_SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [clubSlug, searchable, key]);

  async function send(current: Extract<Step, { kind: "confirm" }>) {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await identifyApi.requestLink(clubSlug, current.licencie.id, { email: current.needsEmail ? email.trim() : null });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
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

  const back = () => {
    setFeedback(null);
    setStep({ kind: "search" });
  };
  const banner = feedback ? <Banner tone={feedback.tone} message={feedback.text} /> : null;

  let body;
  if (step.kind === "sent") body = <LicensedLinkSent firstName={step.firstName} maskedEmail={step.maskedEmail} onBack={back} />;
  else if (step.kind === "pending") body = <LicensedLinkPending firstName={step.firstName} onBack={back} />;
  else if (step.kind === "request-sent") body = <LicensedRequestSent onBack={back} />;
  else if (step.kind === "confirm") {
    body = (
      <View style={styles.stack}>
        <BackLink label="Changer de nom" onPress={back} />
        <View style={[styles.selected, { borderColor: `${accent.accent}47`, backgroundColor: accent.soft }]}>
          <Avatar firstName={step.licencie.firstName} lastName={step.licencie.lastInitial} size={44} />
          <AppText variant="headline" style={styles.flex} numberOfLines={1}>
            {displayName(step.licencie)}
          </AppText>
        </View>
        {step.needsEmail ? (
          <TextField label="Ton adresse email" hint="Ton lien y sera envoyé après vérification par le club." value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoFocus />
        ) : (
          <AppText variant="callout" tone="muted">
            On t&apos;envoie un lien sécurisé à l&apos;adresse enregistrée auprès du club. Un geste suffit, sans mot de passe.
          </AppText>
        )}
        {banner}
        <Button label={step.needsEmail ? "Envoyer mon lien" : "Recevoir mon lien sécurisé"} size="lg" loading={busy} disabled={step.needsEmail && !email.trim()} icon={<Ionicons name="mail-outline" size={20} color={accent.ink} />} onPress={() => void send(step)} fullWidth />
      </View>
    );
  } else if (step.kind === "request") {
    body = (
      <View style={styles.stack}>
        <BackLink label="Revenir à la recherche" onPress={back} />
        <View style={styles.gapXs}>
          <AppText variant="title">Prévenir le club</AppText>
          <AppText variant="callout" tone="muted">
            Un responsable ajoute ou corrige ta fiche, puis te répond par email.
          </AppText>
        </View>
        <TextField label="Ton prénom et ton nom" value={query} onChangeText={setQuery} autoCapitalize="words" />
        <TextField label="Ton email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <TextField label="Message (facultatif)" hint="Ton équipe, ta catégorie…" value={message} onChangeText={setMessage} multiline />
        {banner}
        <Button label="Envoyer la demande" size="lg" loading={busy} disabled={!email.trim() || !searchable} onPress={() => void sendAccessRequest()} fullWidth />
      </View>
    );
  } else {
    body = (
      <View style={styles.stack}>
        <View style={styles.gapXs}>
          <AppText variant="eyebrow" color={accent.text}>
            Retrouve ton espace
          </AppText>
          <AppText variant="headline" nativeID="licensed-search-label">
            Ton prénom et ton nom
          </AppText>
        </View>
        <View style={[styles.field, focused ? { borderColor: accent.accent, boxShadow: `0 0 0 4px ${accent.accent}1F` } : null]}>
          <Ionicons name="search" size={19} color={focused ? accent.text : colors.subtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ex. Léa Martin"
            placeholderTextColor={colors.subtle}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus={autoFocus}
            returnKeyType="search"
            textContentType="name"
            accessibilityLabel="Ton prénom et ton nom"
            accessibilityLabelledBy="licensed-search-label"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={styles.input}
          />
          {searching ? <Ionicons name="ellipsis-horizontal" size={18} color={colors.subtle} accessibilityLabel="Recherche en cours" /> : null}
        </View>
        <AppText variant="meta" tone="muted">
          Prénom et nom, dans n&apos;importe quel ordre : les fiches du club s&apos;affichent au fil de la frappe.
        </AppText>

        {searching ? (
          <View style={styles.gapSm} accessibilityLabel="Recherche en cours" accessibilityRole="progressbar">
            {[0, 1].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <Skeleton width={36} height={36} />
                <View style={[styles.flex, styles.gapXs]}>
                  <Skeleton width="45%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : current?.error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <AppText variant="callout" style={styles.center}>
              {current.error}
            </AppText>
            <Button label="Réessayer" variant="secondary" icon={<Ionicons name="refresh" size={18} color={colors.foreground} />} onPress={() => setRetry((n) => n + 1)} />
          </View>
        ) : searchable && results ? (
          results.length ? (
            <View style={styles.gapSm}>
              <AppText variant="meta" tone="muted">
                {results.length > 1 ? `${results.length} licenciés correspondent — lequel es-tu ?` : "Est-ce toi ?"}
              </AppText>
              {results.map((l) => (
                <ResultRow key={l.id} licencie={l} onPress={() => setStep({ kind: "confirm", licencie: l, needsEmail: false })} />
              ))}
              <Pressable accessibilityRole="button" onPress={() => setStep({ kind: "request" })} hitSlop={spacing.sm}>
                <AppText variant="meta" tone="muted" style={styles.link}>
                  Ce n&apos;est aucun de ces noms
                </AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={20} color={colors.muted} />
              </View>
              <AppText variant="headline">Aucun licencié trouvé</AppText>
              <AppText variant="callout" tone="muted" style={styles.center}>
                Vérifie l&apos;orthographe ou essaie avec ton nom tel qu&apos;il figure sur ta licence.
              </AppText>
              <Pressable accessibilityRole="button" onPress={() => setStep({ kind: "request" })} hitSlop={spacing.sm}>
                <AppText variant="callout" color={accent.text} style={styles.strong}>
                  Je ne me trouve pas : prévenir le club
                </AppText>
              </Pressable>
            </View>
          )
        ) : null}
      </View>
    );
  }

  if (variant === "bare") return body;
  return <View style={styles.card}>{body}</View>;
}

function ResultRow({ licencie, onPress }: { licencie: LicencieMatch; onPress: () => void }) {
  const accent = useClubAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${displayName(licencie)}, c'est moi`}
      accessibilityHint="Recevoir mon lien de connexion"
      onPress={() => {
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => [styles.row, pressed ? { transform: [{ scale: 0.985 }], borderColor: accent.accent } : null]}
    >
      <Avatar firstName={licencie.firstName} lastName={licencie.lastInitial} size={40} />
      <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
        {displayName(licencie)}
      </AppText>
      <View style={[styles.pill, { backgroundColor: accent.soft }]}>
        <AppText variant="meta" color={accent.text} style={styles.strong}>
          C&apos;est moi
        </AppText>
        <Ionicons name="chevron-forward" size={14} color={accent.text} />
      </View>
    </Pressable>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={spacing.sm} style={styles.backLink}>
      <Ionicons name="chevron-back" size={16} color={colors.muted} />
      <AppText variant="meta" tone="muted" style={styles.strong}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.94)",
    ...shadows.raised,
  },
  stack: { gap: spacing.md },
  gapXs: { gap: spacing.xs },
  gapSm: { gap: spacing.sm },
  flex: { flex: 1 },
  center: { textAlign: "center" },
  strong: { fontWeight: "600" },
  link: { textDecorationLine: "underline", alignSelf: "flex-start" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
  },
  // Le cadre du champ porte déjà le focus (accent + halo) : pas de second contour.
  input: { ...typography.body, flex: 1, fontSize: 17, minHeight: 54, color: colors.foreground, outlineWidth: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceRaised,
    ...shadows.card,
  },
  pill: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  selected: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: 16, borderWidth: 1 },
  skeletonRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.md, borderRadius: 16, backgroundColor: colors.surface },
  errorBox: { alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: 16, backgroundColor: colors.surface },
  empty: { alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: 16, borderWidth: 1, borderStyle: "dashed", borderColor: colors.borderStrong },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted },
  backLink: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
});
