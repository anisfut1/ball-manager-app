import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type ClubDto, type UpdateClubDto } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Banner, Button, Card, CardSkeletons, ErrorState, SectionHeader, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Quelques couleurs d'accent courantes ; toute couleur « #RRVVBB » reste possible. */
const SWATCHES = ["#1D4ED8", "#0F766E", "#15803D", "#B91C1C", "#C2410C", "#7C3AED", "#BE185D", "#111111"];

/**
 * Réglages du club (admins) : nom, nom court, fuseau horaire, logo (adresse
 * d'une image) et couleur d'accent — PATCH /v1/clubs/{clubId}, comme le site.
 * L'import d'un fichier de logo reste sur le site.
 */
export default function AdminSettingsScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const data = useQuery({ queryKey: queryKeys.adminClub(slug), queryFn: () => adminApi.club(slug) });
  return (
    <AdminScreen title="Réglages du club" onRefresh={() => void data.refetch()}>
      {() =>
        data.isPending ? (
          <CardSkeletons count={2} />
        ) : data.isError ? (
          <ErrorState message={humanMessage(data.error)} onRetry={() => void data.refetch()} />
        ) : (
          <SettingsForm key={data.dataUpdatedAt} slug={slug} club={data.data} />
        )
      }
    </AdminScreen>
  );
}

function SettingsForm({ slug, club }: { slug: string; club: ClubDto }) {
  const queryClient = useQueryClient();
  const uploadedLogo = club.logoUrl?.startsWith("data:") ?? false;
  const [name, setName] = useState(club.name);
  const [shortName, setShortName] = useState(club.shortName ?? "");
  const [timezone, setTimezone] = useState(club.timezone);
  const [logoUrl, setLogoUrl] = useState(uploadedLogo ? "" : (club.logoUrl ?? ""));
  const [accent, setAccent] = useState(club.accentColor ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  const accentValid = accent === "" || HEX.test(accent);
  const logoValid = logoUrl === "" || /^https?:\/\//i.test(logoUrl);
  const previewLogo = logoUrl || (uploadedLogo ? club.logoUrl : null);

  const save = async () => {
    if (!name.trim()) return setFeedback({ tone: "danger", message: "Le nom du club est requis." });
    if (!accentValid) return setFeedback({ tone: "danger", message: "Couleur attendue au format #RRVVBB (ex. #1D4ED8)." });
    if (!logoValid) return setFeedback({ tone: "danger", message: "L'adresse du logo doit commencer par https://." });
    const body: UpdateClubDto = {};
    if (name.trim() !== club.name) body.name = name.trim();
    if ((shortName.trim() || null) !== club.shortName) body.shortName = shortName.trim() || null;
    if (timezone.trim() !== club.timezone) body.timezone = timezone.trim();
    if ((accent || null) !== club.accentColor) body.accentColor = accent || null;
    // Logo importé sur le site (fichier) : gardé tant qu'aucune adresse n'est saisie.
    if (logoUrl ? logoUrl !== club.logoUrl : !uploadedLogo && club.logoUrl) body.logoUrl = logoUrl || null;
    if (Object.keys(body).length === 0) return setFeedback({ tone: "success", message: "Rien à enregistrer." });
    setBusy(true);
    setFeedback(null);
    try {
      await adminApi.updateClub(slug, body);
      setFeedback({ tone: "success", message: "Réglages enregistrés." });
      void queryClient.invalidateQueries({ queryKey: queryKeys.adminClub(slug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.club(slug) });
    } catch (error) {
      setFeedback({ tone: "danger", message: humanMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title="Identité" />
      <Card>
        <TextField label="Nom du club" value={name} onChangeText={setName} />
        <TextField label="Nom court (facultatif)" value={shortName} onChangeText={setShortName} />
        <TextField label="Fuseau horaire" value={timezone} onChangeText={setTimezone} autoCapitalize="none" autoCorrect={false} hint="Ex. Europe/Paris" />
      </Card>

      <SectionHeader title="Apparence" />
      <Card>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>{previewLogo ? <Image source={{ uri: previewLogo }} style={styles.logo} contentFit="contain" /> : <AppText variant="meta" tone="subtle">Aucun logo</AppText>}</View>
          <AppText variant="meta" tone="muted" style={styles.flex}>
            {uploadedLogo && !logoUrl ? "Logo importé depuis le site. Saisis une adresse pour le remplacer, ou importe un autre fichier sur le site." : "Logo affiché en haut de l'app et sur les cartes de match."}
          </AppText>
        </View>
        <TextField label="Adresse du logo (facultatif)" value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://…" error={logoValid ? null : "L'adresse doit commencer par https://."} />
        <TextField label="Couleur d'accent" value={accent} onChangeText={(v) => setAccent(v.trim())} autoCapitalize="characters" autoCorrect={false} placeholder="#1D4ED8" error={accentValid ? null : "Format attendu : #RRVVBB."} />
        <View style={styles.swatches}>
          {SWATCHES.map((hex) => (
            <Pressable key={hex} accessibilityRole="button" accessibilityLabel={`Couleur ${hex}`} onPress={() => setAccent(hex)} style={[styles.swatch, { backgroundColor: hex }, accent.toUpperCase() === hex && styles.swatchSelected]} />
          ))}
        </View>
      </Card>

      {feedback ? <Banner tone={feedback.tone} message={feedback.message} /> : null}
      <Button label="Enregistrer" loading={busy} onPress={() => void save()} fullWidth />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  logoBox: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logo: { width: 56, height: 56 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatch: { width: 36, height: 36, borderRadius: radius.pill, borderWidth: 2, borderColor: "transparent" },
  swatchSelected: { borderColor: colors.foreground },
});
