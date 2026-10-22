import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type ClubVenueAdminDto, type VenueClosureDto, type VenueClosurePeriod } from "@/api/endpoints/admin";
import { humanMessage } from "@/api/errors";
import { queryKeys } from "@/api/queryKeys";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, Card, CardSkeletons, EmptyState, ErrorState, ListRow, SectionHeader, SegmentedControl, Sheet, TextField } from "@/components/ui";
import { colors, radius, spacing } from "@/design";
import { AdminScreen } from "@/features/admin/AdminScreen";
import { DayPicker } from "@/features/admin/DayPicker";
import { closureDates, todayIn } from "@/features/admin/dates";

const PERIODS: { value: VenueClosurePeriod; label: string }[] = [
  { value: "day", label: "Journée" },
  { value: "morning", label: "Matin" },
  { value: "afternoon", label: "Après-midi" },
];
const PERIOD_DETAIL: Record<VenueClosurePeriod, string> = { day: "journée entière", morning: "matin (avant 13 h)", afternoon: "après-midi (dès 13 h)" };

/**
 * Gymnases du club (admins) : indisponibilités par journée ou demi-journée,
 * avec les matchs à domicile et entraînements prévus pendant (conflits), et
 * gymnases proposés dans le planning des dérogations. Comme sur le site.
 */
export default function AdminVenuesScreen() {
  const club = useActiveClub();
  const slug = club.clubSlug;
  const queryClient = useQueryClient();
  const venues = useQuery({ queryKey: queryKeys.adminVenues(slug), queryFn: () => adminApi.venues(slug) });
  const closures = useQuery({ queryKey: queryKeys.adminClosures(slug), queryFn: () => adminApi.closures(slug) });
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "danger"; message: string } | null>(null);

  const refresh = () => {
    void venues.refetch();
    void closures.refetch();
  };

  const toggle = useMutation({
    mutationFn: ({ venue, active }: { venue: ClubVenueAdminDto; active: boolean }) => adminApi.updateVenue(slug, venue.id, { active }),
    onSuccess: (updated) => queryClient.setQueryData<ClubVenueAdminDto[]>(queryKeys.adminVenues(slug), (list) => list?.map((v) => (v.id === updated.id ? updated : v))),
    onError: (error) => setNotice({ tone: "danger", message: humanMessage(error) }),
  });

  const remove = (closure: VenueClosureDto) =>
    Alert.alert("Supprimer cette indisponibilité ?", `${closure.venueName}, ${closureDates(closure.startDate, closure.endDate)} (${PERIOD_DETAIL[closure.period]}).`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () =>
          void adminApi
            .deleteClosure(slug, closure.id)
            .then(() => queryClient.setQueryData<VenueClosureDto[]>(queryKeys.adminClosures(slug), (list) => list?.filter((c) => c.id !== closure.id)))
            .catch((error: unknown) => setNotice({ tone: "danger", message: humanMessage(error) })),
      },
    ]);

  return (
    <AdminScreen title="Gymnases" onRefresh={refresh}>
      {() => (
        <>
          {notice ? <Banner tone={notice.tone} message={notice.message} onClose={() => setNotice(null)} /> : null}

          <SectionHeader title="Indisponibilités" action={venues.data?.length ? <Button label="Ajouter" variant="secondary" icon={<Ionicons name="add" size={18} color={colors.foreground} />} onPress={() => setAdding(true)} /> : undefined} />
          {closures.isPending ? (
            <CardSkeletons count={1} />
          ) : closures.isError ? (
            <ErrorState message={humanMessage(closures.error)} onRetry={() => void closures.refetch()} />
          ) : closures.data.length === 0 ? (
            <Card>
              <AppText variant="callout" tone="muted">
                Aucune indisponibilité à venir. Ajoute les journées ou demi-journées où un gymnase n’est pas disponible : les matchs et entraînements prévus pendant apparaîtront comme conflits.
              </AppText>
            </Card>
          ) : (
            closures.data.map((closure) => <ClosureCard key={closure.id} closure={closure} timeZone={club.timezone} onDelete={() => remove(closure)} onOpenMatch={(id) => router.push(`/c/${slug}/matchs/${id}`)} />)
          )}

          <SectionHeader title="Gymnases proposés" />
          {venues.isPending ? (
            <CardSkeletons count={1} />
          ) : venues.isError ? (
            <ErrorState message={humanMessage(venues.error)} onRetry={() => void venues.refetch()} />
          ) : venues.data.length === 0 ? (
            <EmptyState icon="business-outline" title="Aucun gymnase" message="Les gymnases apparaîtront après la synchronisation FFBB des matchs à domicile." />
          ) : (
            <Card padded={false} style={{ paddingHorizontal: 16 }}>
              {venues.data.map((venue) => (
                <ListRow
                  key={venue.id}
                  title={venue.name}
                  subtitle={venue.address ?? (venue.active ? "Proposé dans le planning des dérogations" : "Masqué du planning")}
                  trailing={<Switch value={venue.active} onValueChange={(active) => toggle.mutate({ venue, active })} accessibilityLabel={`Proposer ${venue.name} dans le planning`} />}
                />
              ))}
            </Card>
          )}

          {venues.data ? (
            <AddClosureSheet
              visible={adding}
              venues={venues.data}
              today={todayIn(club.timezone)}
              onClose={() => setAdding(false)}
              onCreate={async (body) => {
                const closure = await adminApi.createClosure(slug, body);
                queryClient.setQueryData<VenueClosureDto[]>(queryKeys.adminClosures(slug), (list) => [...(list ?? []), closure].sort((a, b) => a.startDate.localeCompare(b.startDate)));
                setAdding(false);
                const count = closure.conflicts.length;
                setNotice(count ? { tone: "danger", message: `Indisponibilité ajoutée : ${count} conflit${count > 1 ? "s" : ""} à régler.` } : { tone: "success", message: "Indisponibilité ajoutée, aucun conflit." });
              }}
            />
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

function conflictWhen(iso: string, timeZone: string): string {
  const label = new Date(iso).toLocaleString("fr-FR", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function ClosureCard({ closure, timeZone, onDelete, onOpenMatch }: { closure: VenueClosureDto; timeZone: string; onDelete: () => void; onOpenMatch: (matchId: string) => void }) {
  const dates = closureDates(closure.startDate, closure.endDate);
  return (
    <Card>
      <View style={styles.head}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{closure.venueName}</AppText>
          <AppText variant="meta" tone="muted">{`${dates.charAt(0).toUpperCase()}${dates.slice(1)} · ${PERIOD_DETAIL[closure.period]}${closure.reason ? ` · ${closure.reason}` : ""}`}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Supprimer l'indisponibilité" onPress={onDelete} hitSlop={8} style={styles.delete}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>
      {closure.conflicts.length ? (
        <>
          <Badge tone="danger" label={`${closure.conflicts.length} conflit${closure.conflicts.length > 1 ? "s" : ""}`} />
          <View style={styles.conflicts}>
            {closure.conflicts.map((conflict) => {
              const label = conflict.kind === "MATCH" ? `Match ${conflict.teamName ?? ""}${conflict.opponentName ? ` contre ${conflict.opponentName}` : ""}` : `Entraînement ${conflict.teamName ?? ""}`;
              return (
                <Pressable
                  key={`${conflict.kind}:${conflict.id}`}
                  accessibilityRole={conflict.kind === "MATCH" ? "link" : undefined}
                  disabled={conflict.kind !== "MATCH"}
                  onPress={() => onOpenMatch(conflict.id)}
                  style={styles.conflict}
                >
                  <Ionicons name={conflict.kind === "MATCH" ? "trophy-outline" : "barbell-outline"} size={16} color={colors.danger} />
                  <View style={styles.flex}>
                    <AppText variant="meta" tone="muted">{conflictWhen(conflict.startsAt, timeZone)}</AppText>
                    <AppText variant="callout">{label.trim()}</AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : (
        <Badge tone="success" label="Aucun conflit" />
      )}
    </Card>
  );
}

function AddClosureSheet({
  visible,
  venues,
  today,
  onClose,
  onCreate,
}: {
  visible: boolean;
  venues: ClubVenueAdminDto[];
  today: string;
  onClose: () => void;
  onCreate: (body: { clubVenueId: string; startDate: string; endDate: string; period: VenueClosurePeriod; reason?: string }) => Promise<void>;
}) {
  const [venueId, setVenueId] = useState(venues.find((v) => v.active)?.id ?? venues[0]?.id ?? "");
  const [period, setPeriod] = useState<VenueClosurePeriod>("day");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"start" | "end">("start");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!venueId || !startDate) return setError("Choisis le gymnase et le jour.");
    setBusy(true);
    setError(null);
    try {
      await onCreate({ clubVenueId: venueId, startDate, endDate: endDate ?? startDate, period, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      setStartDate(null);
      setEndDate(null);
      setReason("");
      setStep("start");
    } catch (err) {
      setError(humanMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} title="Indisponibilité" onClose={onClose}>
      <View style={styles.field}>
        <AppText variant="bodyStrong">Gymnase</AppText>
        <Card padded={false} style={{ paddingHorizontal: 16 }}>
          {venues.map((v) => (
            <ListRow key={v.id} title={v.name} trailing={v.id === venueId ? <Ionicons name="checkmark" size={20} color={colors.success} /> : undefined} onPress={() => setVenueId(v.id)} />
          ))}
        </Card>
      </View>
      <View style={styles.field}>
        <AppText variant="bodyStrong">Période</AppText>
        <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
        <AppText variant="meta" tone="muted">Matin : avant 13 h. Après-midi : à partir de 13 h. Appliqué à chaque jour.</AppText>
      </View>
      <View style={styles.field}>
        <SegmentedControl
          options={[
            { value: "start", label: startDate ? `Du ${closureDates(startDate, startDate)}` : "Du…" },
            { value: "end", label: endDate ? `Au ${closureDates(endDate, endDate)}` : "Au (facultatif)" },
          ]}
          value={step}
          onChange={setStep}
        />
        <View style={styles.calendar}>
          {step === "start" ? (
            <DayPicker
              value={startDate}
              min={today}
              onChange={(day) => {
                setStartDate(day);
                if (endDate && endDate < day) setEndDate(null);
              }}
            />
          ) : (
            <DayPicker value={endDate} min={startDate ?? today} onChange={setEndDate} />
          )}
        </View>
        {endDate ? <Button label="Un seul jour" variant="ghost" onPress={() => setEndDate(null)} /> : null}
      </View>
      <TextField label="Motif (facultatif)" value={reason} onChangeText={setReason} maxLength={200} placeholder="Ex. tournoi de la mairie, travaux…" />
      {error ? <Banner tone="danger" message={error} /> : null}
      <Button label="Ajouter l'indisponibilité" loading={busy} onPress={() => void submit()} fullWidth />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  flex: { flex: 1, gap: 2 },
  delete: { padding: spacing.xs },
  conflicts: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft },
  conflict: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  field: { gap: spacing.sm },
  calendar: { padding: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
});
