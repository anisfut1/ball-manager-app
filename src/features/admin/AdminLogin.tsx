import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { adminSignIn } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { AppText, Banner, Button, Card, TextField } from "@/components/ui";
import { colors, spacing } from "@/design";

/**
 * Connexion à l'administration du club avec le COMPTE du site (une fois par
 * appareil). Le serveur refuse tout compte qui n'est pas administrateur de
 * ce club : le badge « Admin » de la liste des joueurs ne suffit pas.
 */
export function AdminLogin({ clubSlug, clubName }: { clubSlug: string; clubName: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError("Renseigne ton email et ton mot de passe.");
    setBusy(true);
    setError(null);
    try {
      await adminSignIn(clubSlug, email, password);
    } catch (err) {
      setError(humanMessage(err));
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark-outline" size={28} color={colors.muted} />
        <AppText variant="title">Administration</AppText>
        <AppText variant="callout" tone="muted">
          {`Réservée aux administrateurs de ${clubName}. Connecte-toi avec ton compte du site ball-manager.fr (une seule fois sur cet iPhone).`}
        </AppText>
      </View>
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email" />
      <TextField label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" onSubmitEditing={() => void submit()} />
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label="Se connecter" loading={busy} onPress={() => void submit()} fullWidth />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm },
});
