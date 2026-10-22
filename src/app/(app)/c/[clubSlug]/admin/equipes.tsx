import { useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type TeamDto } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, ListRow, SectionHeader, SegmentedControl, Sheet, TextField } from "@/components/ui";
import { colors, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";

type Sexe = "" | "M" | "F";

function teamMeta(team: TeamDto): string {
  return [team.category, team.sexe, team.numeroEquipe ? `n° ${team.numeroEquipe}` : null].filter(Boolean).join(" · ") || "Catégorie non renseignée";
}

/**
 * Équipes du club (admins) : créer, renommer, reclasser ou désactiver une
 * équipe — même avant son engagement FFBB (la synchro la retrouve ensuite
 * par catégorie, sexe et numéro, jamais par le nom). Comme sur le site.
 */
export default function AdminTeamsScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: queryKeys.adminTeams(slug), queryFn: () => adminApi.teams(slug) });
  const [editing, setEditing] = useState<TeamDto | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const sorted = [...(teams.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));

  const saved = (message: string) => {
    setEditing(null);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminTeams(slug) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.teams(slug) });
  };

  return (
    <AdminScreen title="Équipes" onRefresh={() => void teams.refetch()}>
      {() => (
        <>
          {notice ? <Banner tone="success" message={notice} onClose={() => setNotice(null)} /> : null}
          <AppText variant="callout" tone="muted">
            La synchronisation FFBB réutilise ces équipes (par catégorie, sexe et numéro, jamais par le nom) : tu peux en créer une avant son engagement.
          </AppText>
          <Button label="Nouvelle équipe" onPress={() => setEditing("new")} fullWidth />

          <SectionHeader title={teams.data ? `Équipes (${sorted.length})` : "Équipes"} />
          {teams.isPending ? (
            <CardSkeletons count={3} />
          ) : teams.isError ? (
            <ErrorState message={humanMessage(teams.error)} onRetry={() => void teams.refetch()} />
          ) : sorted.length === 0 ? (
            <EmptyState icon="shirt-outline" title="Aucune équipe enregistrée" />
          ) : (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {sorted.map((team) => (
                <ListRow
                  key={team.id}
                  title={team.name}
                  subtitle={teamMeta(team)}
                  leading={<Ionicons name="shirt-outline" size={22} color={colors.muted} />}
                  trailing={<Badge tone={team.active ? "success" : "neutral"} label={team.active ? "Active" : "Inactive"} />}
                  onPress={() => setEditing(team)}
                  accessibilityHint="Modifier l'équipe"
                />
              ))}
            </Card>
          )}

          {editing ? (
            <TeamSheet
              key={editing === "new" ? "new" : editing.id}
              team={editing === "new" ? null : editing}
              onClose={() => setEditing(null)}
              onSave={async (body) => {
                if (editing === "new") {
                  await adminApi.createTeam(slug, { name: body.name, category: body.category, sexe: body.sexe, numeroEquipe: body.numeroEquipe });
                  saved("Équipe créée.");
                } else {
                  await adminApi.updateTeam(slug, editing.id, body);
                  saved("Équipe mise à jour.");
                }
              }}
            />
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

function TeamSheet({
  team,
  onClose,
  onSave,
}: {
  team: TeamDto | null;
  onClose: () => void;
  onSave: (body: { name: string; category: string | null; sexe: "M" | "F" | null; numeroEquipe: string | null; active: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [category, setCategory] = useState(team?.category ?? "");
  const [sexe, setSexe] = useState<Sexe>(team?.sexe ?? "");
  const [numero, setNumero] = useState(team?.numeroEquipe ?? "");
  const [active, setActive] = useState(team?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return setError("Donne un nom à l'équipe.");
    setBusy(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), category: category.trim() || null, sexe: sexe || null, numeroEquipe: numero.trim() || null, active });
    } catch (err) {
      setError(humanMessage(err));
      setBusy(false);
    }
  };

  return (
    <Sheet visible title={team ? team.name : "Nouvelle équipe"} onClose={onClose}>
      <TextField label="Nom" value={name} onChangeText={setName} placeholder="U11M-1" autoCapitalize="characters" />
      <TextField label="Catégorie" value={category} onChangeText={setCategory} placeholder="U11, SM…" autoCapitalize="characters" />
      <View style={styles.field}>
        <AppText variant="bodyStrong">Sexe</AppText>
        <SegmentedControl<Sexe>
          options={[
            { value: "", label: "—" },
            { value: "M", label: "M" },
            { value: "F", label: "F" },
          ]}
          value={sexe}
          onChange={setSexe}
        />
      </View>
      <TextField label="N° équipe" value={numero} onChangeText={setNumero} placeholder="1, 2…" keyboardType="number-pad" />
      {team ? (
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Active</AppText>
            <AppText variant="meta" tone="muted">
              Une équipe inactive n’apparaît plus dans les listes du club.
            </AppText>
          </View>
          <Switch value={active} onValueChange={setActive} accessibilityLabel="Équipe active" />
        </View>
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label={team ? "Enregistrer" : "Créer l'équipe"} loading={busy} onPress={() => void submit()} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
});
