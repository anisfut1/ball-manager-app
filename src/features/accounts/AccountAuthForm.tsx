import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, humanMessage } from "@/api/errors";
import { accountApi, type AccountSessionDto } from "@/api/endpoints/account";
import { AppText, Banner, Button, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";

export type AccountAuthMode = "sign-in" | "sign-up";
type Step = AccountAuthMode | "code" | "forgot" | "forgot-sent";

/**
 * Connexion ou création de compte (email + mot de passe), même parcours que
 * le site. Création : un code à 6 chiffres arrive par email. Le mot de passe
 * n'est jamais gardé : seule la session (jetons) l'est, dans le trousseau.
 */
export function AccountAuthForm({ initialMode = "sign-up", intro, onAuthenticated }: { initialMode?: AccountAuthMode; intro?: string; onAuthenticated: (session: AccountSessionDto) => Promise<void> }) {
  const accent = useClubAccent();
  const [step, setStep] = useState<Step>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const go = (next: Step) => {
    setError(null);
    setInfo(null);
    setStep(next);
  };

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const address = email.trim();
    try {
      if (step === "sign-in") {
        try {
          await onAuthenticated(await accountApi.signIn(address, password));
        } catch (err) {
          if (err instanceof ApiError && err.code === "EMAIL_NOT_CONFIRMED") {
            await accountApi.resendCode(address).catch(() => undefined);
            setStep("code");
            setInfo("Ton adresse n'est pas encore vérifiée : on vient de t'envoyer un code.");
            return;
          }
          throw err;
        }
      } else if (step === "sign-up") {
        await accountApi.signUp(address, password);
        setStep("code");
      } else if (step === "code") {
        await onAuthenticated(await accountApi.verify(address, code.trim(), password));
      } else if (step === "forgot") {
        await accountApi.passwordReset(address);
        setStep("forgot-sent");
      }
    } catch (err) {
      setError(humanMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (step === "forgot-sent") {
    return (
      <View style={styles.stack}>
        <Banner tone="info" message={`Si un compte existe pour ${email.trim()}, tu as reçu un lien pour choisir un nouveau mot de passe.`} />
        <Button label="Revenir à la connexion" variant="secondary" onPress={() => go("sign-in")} fullWidth />
      </View>
    );
  }

  const disabled = step === "code" ? code.length !== 6 : step === "forgot" ? !email.trim() : !email.trim() || !password;
  const label = step === "sign-in" ? "Se connecter" : step === "sign-up" ? "Créer mon compte" : step === "code" ? "Valider le code" : "Envoyer le lien";

  return (
    <View style={styles.stack}>
      {step === "sign-in" || step === "sign-up" ? (
        <View style={styles.tabs} accessibilityRole="tablist">
          {(["sign-up", "sign-in"] as const).map((mode) => (
            <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: step === mode }} onPress={() => go(mode)} style={[styles.tab, step === mode ? styles.tabActive : null]}>
              <AppText variant={step === mode ? "bodyStrong" : "body"} tone={step === mode ? undefined : "muted"}>
                {mode === "sign-up" ? "Créer un compte" : "J'ai un compte"}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {intro && (step === "sign-in" || step === "sign-up") ? (
        <AppText variant="callout" tone="muted">
          {intro}
        </AppText>
      ) : null}

      {step === "code" ? (
        <>
          <AppText variant="callout" tone="muted">
            On a envoyé un code à 6 chiffres à {email.trim()}. Saisis-le pour terminer.
          </AppText>
          <TextField label="Code reçu par email" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" autoFocus />
        </>
      ) : (
        <>
          {step === "forgot" ? (
            <AppText variant="callout" tone="muted">
              Indique ton adresse : on t&apos;envoie un lien pour choisir un nouveau mot de passe.
            </AppText>
          ) : null}
          <TextField label="Adresse email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType={step === "sign-up" ? "username" : "emailAddress"} />
          {step !== "forgot" ? (
            <TextField
              label="Mot de passe"
              hint={step === "sign-up" ? "8 caractères minimum." : undefined}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={step === "sign-up" ? "new-password" : "current-password"}
              textContentType={step === "sign-up" ? "newPassword" : "password"}
            />
          ) : null}
        </>
      )}

      {info ? <Banner tone="info" message={info} /> : null}
      {error ? <Banner tone="danger" message={error} /> : null}

      <Button label={label} size="lg" loading={busy} disabled={disabled} icon={<Ionicons name={step === "sign-in" ? "log-in-outline" : step === "sign-up" ? "person-add-outline" : "checkmark-circle-outline"} size={20} color={accent.ink} />} onPress={() => void submit()} fullWidth />

      {step === "sign-in" ? <Button label="Mot de passe oublié ?" variant="ghost" onPress={() => go("forgot")} /> : null}
      {step === "code" ? (
        <View style={styles.row}>
          <Button label="Changer d'adresse" variant="ghost" onPress={() => go("sign-up")} />
          <Button
            label="Renvoyer le code"
            variant="ghost"
            onPress={() =>
              void accountApi
                .resendCode(email.trim())
                .catch(() => undefined)
                .then(() => setInfo("Nouveau code envoyé. Pense à regarder dans les indésirables."))
            }
          />
        </View>
      ) : null}
      {step === "forgot" ? <Button label="Revenir à la connexion" variant="ghost" onPress={() => go("sign-in")} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  tabs: { flexDirection: "row", gap: 4, padding: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  tab: { flex: 1, alignItems: "center", paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabActive: { backgroundColor: colors.surfaceRaised },
  row: { flexDirection: "row", justifyContent: "space-between" },
});
