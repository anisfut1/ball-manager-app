import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { tablesApi, type TableRole } from "@/api/endpoints/tables";
import type { Dto } from "@/api/types";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Avatar, Badge, Banner, Button, CardSkeletons, Sheet } from "@/components/ui";
import { colors, MAX_FONT_SCALE, radius, spacing, typography } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { matchesSearch } from "./search";

type Candidate = Dto<"TableSuggestionCandidateDto">;
type Unavailable = Dto<"TableUnavailableCandidateDto">;

const REASON_ICON: Record<Candidate["reasons"][number]["code"], keyof typeof Ionicons.glyphMap> = {
  NEXT_HOME_MATCH: "time-outline",
  PREVIOUS_HOME_MATCH: "time-outline",
  SAME_VENUE: "location-outline",
  SEASON_DUTY_COUNT: "clipboard-outline",
};

const UNAVAILABLE_ICON: Record<Unavailable["reasonCode"], keyof typeof Ionicons.glyphMap> = {
  MATCH_CONFLICT: "navigate-outline",
  TABLE_ASSIGNMENT_CONFLICT: "clipboard-outline",
  ALREADY_ASSIGNED_ON_MATCH: "person-outline",
};

/**
 * Choisir un marqueur / chronométreur / délégué / arbitre — copie du
 * panneau du web : recherche par nom ou équipe (filtre à chaque lettre),
 * Recommandés, Potentiellement disponibles, Indisponibles (« Choisir quand
 * même » si la personne joue sur ce créneau). Jamais d'affectation
 * automatique : un choix = un appel.
 */
export function TableSuggestionsSheet({ visible, onClose, matchId, role, roleLabel, as }: { visible: boolean; onClose: () => void; matchId: string; role: TableRole; roleLabel: string; as: string }) {
  const club = useActiveClub();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [conflictNote, setConflictNote] = useState<string | null>(null);
  const suggestions = useQuery({ queryKey: queryKeys.tableSuggestions(club.clubSlug, matchId, role), queryFn: () => tablesApi.suggestions(club.clubSlug, as, matchId, role), enabled: visible });
  const assign = useMutation({
    mutationFn: (v: { licencieId: string; ignoreMatchConflict: boolean }) => tablesApi.assign(club.clubSlug, as, matchId, role, v.licencieId, v.ignoreMatchConflict),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tables(club.clubSlug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.actionCenterAll(club.clubSlug) });
      onClose();
    },
    onError: (e) => {
      // Conflit apparu entre-temps : message + suggestions actualisées (comme le web).
      if (e instanceof ApiError && e.status === 409) {
        setConflictNote(`${e.message} — les suggestions ci-dessous ont été actualisées.`);
        void suggestions.refetch();
      }
    },
  });
  const choosing = assign.isPending ? (assign.variables?.licencieId ?? null) : null;
  const data = suggestions.data;
  const filtered = useMemo(() => {
    if (!data) return null;
    const keep = <T extends { licencie: { firstName: string; lastName: string }; teams: { name: string }[] }>(list: T[]) => list.filter((c) => matchesSearch(search, `${c.licencie.firstName} ${c.licencie.lastName}`, c.teams));
    return { recommended: keep(data.recommended), available: keep(data.available), unavailable: keep(data.unavailable) };
  }, [data, search]);
  const choose = (licencieId: string, ignoreMatchConflict = false) => {
    setConflictNote(null);
    assign.mutate({ licencieId, ignoreMatchConflict });
  };
  const nothing = filtered && search.trim() && !filtered.recommended.length && !filtered.available.length && !filtered.unavailable.length;

  return (
    <Sheet visible={visible} title={`Choisir un ${roleLabel.toLowerCase()}`} onClose={onClose}>
      <AppText variant="meta" tone="muted">{`Aucune suggestion n'est affectée automatiquement — ${roleLabel.toLowerCase()} choisi uniquement sur « Choisir ».`}</AppText>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.subtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un nom, une équipe…"
          placeholderTextColor={colors.subtle}
          accessibilityLabel="Rechercher un nom, une équipe"
          autoCorrect={false}
          autoCapitalize="words"
          clearButtonMode="while-editing"
          returnKeyType="search"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={styles.searchInput}
        />
      </View>
      {conflictNote ? <Banner tone="danger" message={conflictNote} /> : null}
      {assign.error && !conflictNote ? <Banner tone="danger" message={humanMessage(assign.error)} /> : null}
      {suggestions.isPending ? <CardSkeletons count={3} /> : null}
      {suggestions.error ? <Banner tone="danger" message={humanMessage(suggestions.error)} /> : null}
      {nothing ? (
        <AppText variant="callout" tone="muted">{`Personne ne correspond à « ${search.trim()} ».`}</AppText>
      ) : filtered ? (
        <>
          <Section title="Recommandés" count={filtered.recommended.length} empty="Aucun candidat recommandé pour ce poste.">
            {filtered.recommended.map((c) => (
              <CandidateRow key={c.licencie.id} candidate={c} choosing={choosing === c.licencie.id} disabled={assign.isPending} onChoose={() => choose(c.licencie.id)} />
            ))}
          </Section>
          <Section title="Potentiellement disponibles" count={filtered.available.length} empty="Aucun autre candidat sans conflit connu.">
            {filtered.available.map((c) => (
              <CandidateRow key={c.licencie.id} candidate={c} choosing={choosing === c.licencie.id} disabled={assign.isPending} onChoose={() => choose(c.licencie.id)} />
            ))}
          </Section>
          {filtered.unavailable.length ? (
            <Section title="Indisponibles" count={filtered.unavailable.length}>
              {filtered.unavailable.map((c) => (
                <UnavailableRow key={c.licencie.id} candidate={c} choosing={choosing === c.licencie.id} disabled={assign.isPending} onForce={() => choose(c.licencie.id, true)} />
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <AppText variant="eyebrow" tone="subtle">
          {title}
        </AppText>
        <View style={styles.count}>
          <AppText variant="meta" tone="muted">
            {String(count)}
          </AppText>
        </View>
      </View>
      {count === 0 && empty ? (
        <AppText variant="meta" tone="muted">
          {empty}
        </AppText>
      ) : (
        children
      )}
    </View>
  );
}

function PersonHead({ licencie, teams, muted, badge }: { licencie: Candidate["licencie"]; teams: { name: string }[]; muted?: boolean; badge: React.ReactNode }) {
  return (
    <View style={styles.head}>
      <Avatar firstName={licencie.firstName} lastName={licencie.lastName} photoUrl={licencie.photoUrl} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" tone={muted ? "muted" : "default"} numberOfLines={1}>{`${licencie.firstName} ${licencie.lastName}`}</AppText>
        {teams.length ? (
          <AppText variant="meta" tone="muted" numberOfLines={1}>
            {teams.map((t) => t.name).join(", ")}
          </AppText>
        ) : null}
      </View>
      {badge}
    </View>
  );
}

function CandidateRow({ candidate, choosing, disabled, onChoose }: { candidate: Candidate; choosing: boolean; disabled: boolean; onChoose: () => void }) {
  const accent = useClubAccent();
  const recommended = candidate.eligibility === "RECOMMENDED";
  return (
    <View style={[styles.card, recommended && { borderColor: accent.accent }]}>
      <PersonHead licencie={candidate.licencie} teams={candidate.teams} badge={<Badge tone={recommended ? "success" : "neutral"} label={recommended ? "Recommandé" : "Potentiellement disponible"} />} />
      {candidate.reasons.map((r) => (
        <View key={r.code} style={styles.indent}>
          <Ionicons name={REASON_ICON[r.code]} size={14} color={colors.subtle} />
          <AppText variant="meta" tone="muted" style={styles.flex}>
            {r.label}
          </AppText>
        </View>
      ))}
      <View style={styles.foot}>
        {candidate.isCurrentHolder ? (
          <AppText variant="meta" color={accent.text}>
            Affecté actuellement
          </AppText>
        ) : (
          <View />
        )}
        <Button label={candidate.isCurrentHolder ? "Déjà affecté" : "Choisir"} variant={recommended ? "primary" : "secondary"} disabled={candidate.isCurrentHolder || disabled} loading={choosing} onPress={onChoose} />
      </View>
    </View>
  );
}

/** Seul « son équipe joue sur ce créneau » peut être passé outre, avec confirmation (comme le web). */
function UnavailableRow({ candidate, choosing, disabled, onForce }: { candidate: Unavailable; choosing: boolean; disabled: boolean; onForce: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={[styles.card, styles.unavailable]}>
      <PersonHead licencie={candidate.licencie} teams={candidate.teams} muted badge={<Badge tone="danger" label="Indisponible" />} />
      <View style={styles.indent}>
        <Ionicons name={UNAVAILABLE_ICON[candidate.reasonCode]} size={14} color={colors.subtle} />
        <AppText variant="meta" tone="muted" style={styles.flex}>
          {candidate.reason}
        </AppText>
      </View>
      {candidate.reasonCode === "MATCH_CONFLICT" ? (
        confirming ? (
          <View style={styles.confirm}>
            <AppText variant="meta">Il ne joue pas ce match ? Le désigner quand même :</AppText>
            <View style={styles.row}>
              <Button label="Confirmer" loading={choosing} disabled={disabled} onPress={onForce} />
              <Button label="Annuler" variant="ghost" disabled={choosing} onPress={() => setConfirming(false)} />
            </View>
          </View>
        ) : (
          <View style={styles.confirm}>
            <Button label="Choisir quand même" variant="secondary" disabled={disabled} onPress={() => setConfirming(true)} style={styles.start} />
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised },
  searchInput: { flex: 1, ...typography.body, color: colors.foreground, paddingVertical: spacing.sm },
  section: { gap: spacing.sm },
  sectionTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  count: { paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  unavailable: { backgroundColor: colors.surfaceMuted },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  indent: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingLeft: 48 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 48 },
  confirm: { gap: spacing.sm, paddingLeft: 48 },
  row: { flexDirection: "row", gap: spacing.sm },
  start: { alignSelf: "flex-start" },
});
