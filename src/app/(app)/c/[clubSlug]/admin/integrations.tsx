import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, ErrorState, SectionHeader, TextField, type BadgeTone, type BannerTone } from "@/components/ui";
import { colors, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";

const JOB_LABELS: Record<string, string> = {
  test_connection: "Test de connexion FBI",
  discover_emarque: "Téléchargement d'un document e-Marque",
  reconcile_schedule: "Vérification du calendrier",
  check_derogation: "Vérification d'une dérogation",
  check_all_derogations: "Vérification de toutes les dérogations",
  import_licences: "Import des licences",
  create_derogation: "Envoi d'une dérogation",
  respond_derogation: "Réponse à une dérogation",
};

type Feedback = { tone: BannerTone; message: string } | null;

function when(iso: string | null, timeZone: string): string {
  return iso ? new Date(iso).toLocaleString("fr-FR", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Jamais";
}

/**
 * Intégrations (admins) : FFBB, FBI (identifiants, test, outils de
 * dépannage) et e-Marque — comme les pages Intégrations et FBI du site. Une
 * seule connexion FBI à la fois par club : les actions attendent celle en cours.
 */
export default function AdminIntegrationsScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const queryClient = useQueryClient();
  const data = useQuery({
    queryKey: queryKeys.adminIntegrations(slug),
    queryFn: async () => {
      const [integrations, capabilities] = await Promise.all([adminApi.integrations(slug), adminApi.capabilities(slug)]);
      return { integrations, capabilities };
    },
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: queryKeys.adminIntegrations(slug) });

  return (
    <AdminScreen title="Intégrations" onRefresh={() => void data.refetch()}>
      {() =>
        data.isPending ? (
          <CardSkeletons count={3} />
        ) : data.isError ? (
          <ErrorState message={humanMessage(data.error)} onRetry={() => void data.refetch()} />
        ) : (
          <IntegrationsBody slug={slug} timeZone={club.timezone} clubName={club.clubName} {...data.data} fetchedAt={data.dataUpdatedAt} onChanged={refresh} />
        )
      }
    </AdminScreen>
  );
}

function IntegrationsBody({
  slug,
  timeZone,
  clubName,
  integrations,
  capabilities,
  fetchedAt,
  onChanged,
}: {
  slug: string;
  timeZone: string;
  clubName: string;
  integrations: Awaited<ReturnType<typeof adminApi.integrations>>;
  capabilities: Awaited<ReturnType<typeof adminApi.capabilities>>;
  /** Instant du chargement : durée de l'opération FBI en cours. */
  fetchedAt: number;
  onChanged: () => void;
}) {
  const { ffbb, fbi } = integrations;
  const fbiStatus: { label: string; tone: BadgeTone } = !capabilities.fbi ? { label: "Non connecté", tone: "neutral" } : fbi.connected ? { label: "Connecté", tone: "success" } : { label: "En erreur", tone: "danger" };

  return (
    <>
      {fbi.activeJob ? (
        <Banner
          tone="info"
          message={`En cours : ${JOB_LABELS[fbi.activeJob.type] ?? fbi.activeJob.type}, depuis ${Math.max(0, Math.round((fetchedAt - Date.parse(fbi.activeJob.startedAt)) / 60_000))} min. Une seule connexion FBI à la fois : les autres actions attendent.`}
        />
      ) : null}

      <IntegrationCard icon="calendar-outline" name="FFBB" role="Calendrier, résultats, classements" status={ffbb.enabled ? { label: "Connecté", tone: "success" } : { label: "Désactivé", tone: "neutral" }}>
        <Rows rows={[["Dernière synchro", when(ffbb.lastSyncAt, timeZone)], ["Résultat", ffbb.lastSyncStatus ?? "—"]]} />
        <Action
          label="Relancer la synchro FFBB"
          run={async () => {
            const result = await adminApi.triggerFfbbSync(slug);
            onChanged();
            return { tone: "success", message: `Synchronisation terminée (${result.status}).` };
          }}
          pending="Synchronisation en cours… (jusqu'à quelques minutes)"
        />
      </IntegrationCard>

      <IntegrationCard icon="key-outline" name="FBI" role="e-Marque, feuilles de match, dérogations" status={fbiStatus}>
        {capabilities.fbi ? (
          <>
            <Rows rows={[["Identifiant", fbi.username ?? "—"], ["Dernier accès", when(fbi.lastLoginAt, timeZone)]]} />
            {fbi.lastError ? <Banner tone="danger" message={`Dernière erreur : ${fbi.lastError}`} /> : null}
          </>
        ) : (
          <AppText variant="callout" tone="muted">
            {`Optionnel : ${clubName} fonctionne sans FBI. FBI ajoute les feuilles de match, compositions, officiels et statistiques, et l'envoi des dérogations.`}
          </AppText>
        )}
        <FbiCredentials slug={slug} username={fbi.username} onSaved={onChanged} />
        {fbi.configured ? (
          <Action
            label="Tester la connexion"
            pending="Test de connexion en cours…"
            run={async () => {
              const result = await adminApi.testFbi(slug);
              onChanged();
              return { tone: result.success ? "success" : "danger", message: result.message };
            }}
          />
        ) : null}
      </IntegrationCard>

      {fbi.configured ? (
        <>
          <SectionHeader title="Outils FBI" />
          <Card>
            <ToolBlock title="1. Télécharger les documents e-Marque" description="Fait avancer maintenant les téléchargements en attente, sans attendre le passage automatique.">
              <Action
                label="Télécharger"
                pending="Téléchargement en cours…"
                run={async () => {
                  let claimed = 0;
                  let succeeded = 0;
                  let failed = 0;
                  // Quelques lots au plus depuis le téléphone ; le passage automatique fait le reste.
                  for (let round = 0; round < 5; round += 1) {
                    const result = await adminApi.processFbiJobs(slug);
                    claimed += result.claimed;
                    succeeded += result.succeeded;
                    failed += result.failed;
                    if (result.claimed === 0 || result.succeeded === 0) break;
                  }
                  onChanged();
                  if (claimed === 0) return { tone: "success", message: "Rien en attente pour l'instant." };
                  return { tone: failed ? "danger" : "success", message: `${claimed} traité${claimed > 1 ? "s" : ""}, ${succeeded} réussi${succeeded > 1 ? "s" : ""}${failed ? `, ${failed} en échec` : ""}.` };
                }}
              />
            </ToolBlock>
            <ToolBlock title="2. Traiter les documents téléchargés" description="Lit les feuilles téléchargées (composition, statistiques, officiels).">
              <Action
                label="Traiter"
                pending="Traitement en cours…"
                run={async () => {
                  let examined = 0;
                  let imported = 0;
                  let errors = 0;
                  for (let round = 0; round < 10; round += 1) {
                    const result = await adminApi.parseFbiDocuments(slug);
                    examined += result.candidatesExamined;
                    imported += result.imported;
                    errors += result.errors;
                    if (result.candidatesExamined === 0) break;
                  }
                  if (examined === 0) return { tone: "success", message: "Rien à traiter pour l'instant." };
                  return { tone: errors ? "danger" : "success", message: `${examined} document${examined > 1 ? "s" : ""} traité${examined > 1 ? "s" : ""}, ${imported} importé${imported > 1 ? "s" : ""}${errors ? `, ${errors} en échec` : ""}.` };
                }}
              />
            </ToolBlock>
            <ToolBlock title="Vérifier le calendrier" description="Compare le calendrier FFBB à FBI ; les écarts apparaissent dans Anomalies.">
              <Action
                label="Vérifier le calendrier"
                pending="Vérification en cours…"
                run={async () => {
                  await adminApi.reconcileFbiSchedule(slug);
                  const result = await adminApi.processFbiJobs(slug);
                  onChanged();
                  if (result.succeeded > 0) return { tone: "success", message: "Vérification terminée : voir les écarts éventuels dans Anomalies." };
                  if (result.failed > 0) return { tone: "danger", message: "La vérification a échoué : voir Anomalies." };
                  return { tone: "info", message: "Vérification en file : elle démarrera au prochain traitement FBI." };
                }}
              />
            </ToolBlock>
            <ToolBlock title="Vérifier toutes les dérogations" description="Une seule connexion FBI pour mettre à jour toutes les dérogations (état, motif, réponse).">
              <Action
                label="Vérifier sur FBI"
                pending="Vérification en cours… (jusqu'à quelques minutes)"
                run={async () => {
                  const result = await adminApi.checkAllDerogations(slug);
                  onChanged();
                  return { tone: "success", message: `${result.derogationsFound} dérogation${result.derogationsFound > 1 ? "s" : ""} trouvée${result.derogationsFound > 1 ? "s" : ""} sur FBI (${result.matched} rattachée${result.matched > 1 ? "s" : ""} à un match).` };
                }}
              />
            </ToolBlock>
          </Card>
        </>
      ) : null}

      <IntegrationCard
        icon="document-text-outline"
        name="e-Marque"
        role="Composition, officiels, statistiques par joueur"
        status={!capabilities.fbi ? { label: "Nécessite FBI", tone: "neutral" } : fbi.autoImportEmarque ? { label: "Automatique", tone: "success" } : { label: "Désactivé", tone: "neutral" }}
      >
        <AppText variant="callout" tone="muted">
          {!capabilities.fbi
            ? "Les feuilles e-Marque sont récupérées via FBI : connecte FBI pour les activer."
            : fbi.autoImportEmarque
              ? "Les feuilles de match, compositions, officiels et statistiques sont récupérées automatiquement pour chaque match joué."
              : "Récupération automatique désactivée pour l'instant."}
        </AppText>
      </IntegrationCard>
    </>
  );
}

function IntegrationCard({ icon, name, role, status, children }: { icon: keyof typeof Ionicons.glyphMap; name: string; role: string; status: { label: string; tone: BadgeTone }; children: ReactNode }) {
  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name={icon} size={24} color={colors.muted} />
        <View style={styles.flex}>
          <AppText variant="headline">{name}</AppText>
          <AppText variant="meta" tone="muted">
            {role}
          </AppText>
        </View>
        <Badge tone={status.tone} label={status.label} />
      </View>
      {children}
    </Card>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <View style={styles.rows}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <AppText variant="meta" tone="muted" style={styles.rowLabel}>
            {label}
          </AppText>
          <AppText variant="callout" style={styles.flex}>
            {value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function ToolBlock({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <View style={styles.tool}>
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="meta" tone="muted">
        {description}
      </AppText>
      {children}
    </View>
  );
}

/** Bouton d'action avec son retour (en cours, réussite, erreur) juste en dessous. */
function Action({ label, pending, run }: { label: string; pending: string; run: () => Promise<{ tone: BannerTone; message: string }> }) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const go = async () => {
    setBusy(true);
    setFeedback({ tone: "info", message: pending });
    try {
      setFeedback(await run());
    } catch (error) {
      setFeedback({ tone: "danger", message: humanMessage(error) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.action}>
      <Button label={label} variant="secondary" loading={busy} onPress={() => void go()} fullWidth />
      {feedback ? <Banner tone={feedback.tone} message={feedback.message} /> : null}
    </View>
  );
}

function FbiCredentials({ slug, username, onSaved }: { slug: string; username: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(username ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  if (!open) return <Button label={username ? "Modifier les identifiants FBI" : "Connecter FBI"} variant={username ? "ghost" : "primary"} onPress={() => setOpen(true)} fullWidth />;

  const save = async () => {
    if (!login.trim()) return setFeedback({ tone: "danger", message: "L'identifiant est requis." });
    setBusy(true);
    setFeedback(null);
    try {
      await adminApi.saveFbiCredentials(slug, { username: login.trim(), ...(password ? { password } : {}) });
      setPassword("");
      setFeedback({ tone: "success", message: "Identifiants FBI enregistrés." });
      onSaved();
    } catch (error) {
      setFeedback({ tone: "danger", message: humanMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.action}>
      <TextField label="Identifiant FBI" value={login} onChangeText={setLogin} autoCapitalize="none" autoCorrect={false} />
      <TextField label="Mot de passe FBI" value={password} onChangeText={setPassword} secureTextEntry hint={username ? "Laisse vide pour garder le mot de passe enregistré. Jamais réaffiché, chiffré sur le serveur." : "Jamais réaffiché, chiffré sur le serveur."} />
      {feedback ? <Banner tone={feedback.tone} message={feedback.message} /> : null}
      <Button label="Enregistrer" loading={busy} onPress={() => void save()} fullWidth />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  rows: { gap: spacing.xs },
  row: { flexDirection: "row", gap: spacing.sm },
  rowLabel: { width: 110 },
  tool: { gap: spacing.xs, paddingBottom: spacing.sm },
  action: { gap: spacing.sm },
});
