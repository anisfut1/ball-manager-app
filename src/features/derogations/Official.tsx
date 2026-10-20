import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError } from "@/api/errors";
import type { CreateOfficialDerogationBody, OfficialDerogation, OfficialOutcome } from "@/api/endpoints/derogations";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Badge, Banner, Button, EmptyState, TextField, type BadgeTone } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { changesKnown, derogationVerdict, describeRequestedChanges, etatTone, groupDerogationsByMatch, hasDerogationDetail, isRetainedSchedule, supersededBy, type DerogationMatchGroup, type DerogationVerdict } from "./official-groups";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

type Feedback = { kind: "success" | "error" | "warning"; text: string } | null;

function FeedbackBanner({ status }: { status: Feedback }) {
  if (!status) return null;
  return <Banner tone={status.kind === "success" ? "success" : status.kind === "warning" ? "warning" : "danger"} message={status.text} />;
}

export interface OfficialFormState {
  modifierDate: boolean;
  dateDerogation: string; // AAAA-MM-JJ
  modifierHoraire: boolean;
  horaire: string; // HH:MM
  inverserRencontre: boolean;
  inverserEquipe: boolean;
  modifierSalle: boolean;
  clubVenueId: string;
  motif: string;
}

const INITIAL_FORM: OfficialFormState = { modifierDate: false, dateDerogation: "", modifierHoraire: false, horaire: "", inverserRencontre: false, inverserEquipe: false, modifierSalle: false, clubVenueId: "", motif: "" };

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

/**
 * « Créer une dérogation » officielle FBI — copie du formulaire du web :
 * modifier date / horaire / salle (un gymnase du club, quand `venues` est
 * fourni), inverser la rencontre / seulement les équipes (exclusives),
 * motif obligatoire. Écrit réellement sur FBI, jamais
 * annulable depuis l'outil : confirmation explicite avant l'envoi.
 */
export function OfficialDerogationForm({
  submit,
  initial,
  openLabel = "Créer une dérogation",
  onSuccess,
  venues = [],
}: {
  submit: (body: CreateOfficialDerogationBody) => Promise<OfficialOutcome>;
  initial?: Partial<OfficialFormState>;
  openLabel?: string;
  onSuccess?: () => void;
  /** Gymnases du club : active « Modifier la salle ». */
  venues?: { id: string; name: string; active?: boolean }[];
}) {
  const start = { ...INITIAL_FORM, ...initial };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<OfficialFormState>(start);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Feedback>(null);

  const dateOk = !form.modifierDate || DATE.test(form.dateDerogation);
  const timeOk = !form.modifierHoraire || TIME.test(form.horaire);
  const salleOk = !form.modifierSalle || form.clubVenueId.length > 0;
  const inversionOk = !(form.inverserRencontre && form.inverserEquipe);
  const something = form.modifierDate || form.modifierHoraire || form.modifierSalle || form.inverserRencontre || form.inverserEquipe;
  const valid = form.motif.trim().length > 0 && dateOk && timeOk && salleOk && inversionOk && something;
  const salles = venues.filter((venue) => venue.active !== false || venue.id === form.clubVenueId);

  async function send() {
    setPending(true);
    setStatus(null);
    try {
      // « JJ/MM/AAAA » : format FBI réel (comme le web).
      const [y, m, d] = form.dateDerogation.split("-");
      const result = await submit({
        motif: form.motif.trim(),
        modifierDate: form.modifierDate,
        dateDerogation: form.modifierDate && y && m && d ? `${d}/${m}/${y}` : null,
        modifierHoraire: form.modifierHoraire,
        horaire: form.modifierHoraire ? form.horaire : null,
        inverserRencontre: form.inverserRencontre,
        inverserEquipe: form.inverserEquipe,
        modifierSalle: form.modifierSalle,
        clubVenueId: form.modifierSalle ? form.clubVenueId : null,
      });
      if (result.outcome === "success") {
        setStatus({ kind: "success", text: "Dérogation créée sur FBI." });
        setForm(start);
        setOpen(false);
        onSuccess?.();
      } else if (result.outcome === "error") setStatus({ kind: "error", text: result.message ?? "FBI a rejeté la création." });
      else setStatus({ kind: "warning", text: result.message ?? "Résultat incertain — vérifie manuellement sur FBI avant de réessayer." });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof ApiError ? err.message : "Envoi impossible." });
    } finally {
      setPending(false);
      setConfirming(false);
    }
  }

  if (!open) {
    return (
      <View style={styles.gap}>
        <Button label={openLabel} variant="secondary" icon={<Ionicons name="calendar-outline" size={18} color={colors.foreground} />} onPress={() => setOpen(true)} style={styles.start} />
        <FeedbackBanner status={status} />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View>
        <AppText variant="bodyStrong">Nouvelle demande de dérogation</AppText>
        <AppText variant="meta" tone="muted">
          Coche au moins une modification, puis indique le motif.
        </AppText>
      </View>
      <View style={styles.box}>
        <ToggleRow label="Modifier la date" value={form.modifierDate} onChange={(v) => setForm({ ...form, modifierDate: v })} />
        {form.modifierDate ? <TextField label="Nouvelle date (AAAA-MM-JJ)" value={form.dateDerogation} onChangeText={(v) => setForm({ ...form, dateDerogation: v })} keyboardType="numbers-and-punctuation" maxLength={10} error={form.dateDerogation && !dateOk ? "Format AAAA-MM-JJ." : null} /> : null}
        <ToggleRow label="Modifier l'horaire" value={form.modifierHoraire} onChange={(v) => setForm({ ...form, modifierHoraire: v })} />
        {form.modifierHoraire ? <TextField label="Nouvel horaire (HH:MM)" value={form.horaire} onChangeText={(v) => setForm({ ...form, horaire: v })} keyboardType="numbers-and-punctuation" maxLength={5} error={form.horaire && !timeOk ? "Format HH:MM." : null} /> : null}
        {salles.length > 0 ? <ToggleRow label="Modifier la salle" value={form.modifierSalle} onChange={(v) => setForm({ ...form, modifierSalle: v })} /> : null}
        {form.modifierSalle ? (
          <View style={styles.venues} accessibilityRole="radiogroup" accessibilityLabel="Nouvelle salle">
            {salles.map((venue) => {
              const selected = venue.id === form.clubVenueId;
              return (
                <Pressable key={venue.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setForm({ ...form, clubVenueId: venue.id })} style={[styles.venue, selected && styles.venueSelected]}>
                  <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={18} color={selected ? colors.foreground : colors.subtle} />
                  <AppText variant="callout" style={styles.flex}>
                    {venue.name}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <ToggleRow label="Inverser la rencontre" value={form.inverserRencontre} onChange={(v) => setForm({ ...form, inverserRencontre: v, inverserEquipe: v ? false : form.inverserEquipe })} />
        <ToggleRow label="Inverser seulement les équipes" value={form.inverserEquipe} onChange={(v) => setForm({ ...form, inverserEquipe: v, inverserRencontre: v ? false : form.inverserRencontre })} />
      </View>
      <TextField label="Motif de la demande" value={form.motif} onChangeText={(v) => setForm({ ...form, motif: v })} multiline />
      {!something ? (
        <AppText variant="meta" tone="muted">
          Coche au moins une modification (date, horaire, salle ou inversion).
        </AppText>
      ) : null}
      <Banner tone="warning" message="Cette demande sera transmise à la FFBB et ne pourra pas être annulée depuis cet outil." />
      {confirming ? (
        <View style={styles.gap}>
          <AppText variant="callout">Confirmer l&apos;envoi à la FFBB ?</AppText>
          <View style={styles.row}>
            <Button label={pending ? "Envoi en cours…" : "Envoyer à la FFBB"} loading={pending} onPress={() => void send()} />
            <Button label="Retour" variant="ghost" disabled={pending} onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Button label="Envoyer à la FFBB" disabled={!valid} onPress={() => setConfirming(true)} />
          <Button
            label="Annuler"
            variant="secondary"
            onPress={() => {
              setForm(start);
              setStatus(null);
              setOpen(false);
            }}
          />
        </View>
      )}
      <FeedbackBanner status={status} />
    </View>
  );
}

/** Accepter / refuser une dérogation FBI — confirmation explicite, motif obligatoire au refus (comme le web). */
export function RespondToDerogation({ submit, onDone }: { submit: (body: { decision: "accepted" | "refused"; motifRefus: string | null }) => Promise<OfficialOutcome>; onDone: () => void }) {
  const [step, setStep] = useState<"idle" | "accept" | "refuse">("idle");
  const [motif, setMotif] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Feedback>(null);

  async function send(decision: "accepted" | "refused") {
    setPending(true);
    setStatus(null);
    try {
      const result = await submit({ decision, motifRefus: decision === "refused" ? motif.trim() : null });
      if (result.outcome === "success") {
        setStatus({ kind: "success", text: decision === "accepted" ? "Dérogation acceptée sur FBI." : "Dérogation refusée sur FBI." });
        setStep("idle");
        onDone();
      } else if (result.outcome === "error") setStatus({ kind: "error", text: result.message ?? "FBI a rejeté l'envoi." });
      else setStatus({ kind: "warning", text: result.message ?? "Résultat incertain — vérifie manuellement sur FBI avant de réessayer." });
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof ApiError ? err.message : "Envoi impossible." });
    } finally {
      setPending(false);
    }
  }

  if (step === "accept") {
    return (
      <View style={[styles.panel, { backgroundColor: colors.successSoft }]}>
        <AppText variant="callout">Confirmer l&apos;acceptation ? Cette action sera transmise à la FFBB et ne pourra pas être annulée depuis cet outil.</AppText>
        <View style={styles.row}>
          <Button label={pending ? "Envoi en cours…" : "Confirmer l'acceptation"} loading={pending} onPress={() => void send("accepted")} />
          <Button label="Annuler" variant="secondary" disabled={pending} onPress={() => setStep("idle")} />
        </View>
        <FeedbackBanner status={status} />
      </View>
    );
  }
  if (step === "refuse") {
    return (
      <View style={[styles.panel, { backgroundColor: colors.dangerSoft }]}>
        <TextField label="Motif de refus" hint="Obligatoire, transmis à l'adversaire sur FBI." value={motif} onChangeText={setMotif} multiline />
        <AppText variant="callout">Confirmer le refus ? Cette action sera transmise à la FFBB et ne pourra pas être annulée depuis cet outil.</AppText>
        <View style={styles.row}>
          <Button label={pending ? "Envoi en cours…" : "Confirmer le refus"} variant="danger" loading={pending} disabled={!motif.trim()} onPress={() => void send("refused")} />
          <Button label="Annuler" variant="secondary" disabled={pending} onPress={() => setStep("idle")} />
        </View>
        <FeedbackBanner status={status} />
      </View>
    );
  }
  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <Button label="Accepter" onPress={() => setStep("accept")} />
        <Button label="Refuser" variant="danger" onPress={() => setStep("refuse")} />
      </View>
      <FeedbackBanner status={status} />
    </View>
  );
}

const ETAT_TONE: Record<ReturnType<typeof etatTone>, BadgeTone> = { success: "success", danger: "danger", warning: "warning", neutral: "neutral" };

const VERDICT_COPY: Record<DerogationVerdict["kind"], { tone: "warning" | "info" | "success" | "danger"; text: string }> = {
  action_required: { tone: "warning", text: "Une demande attend ta réponse (voir ci-dessous)." },
  pending: { tone: "info", text: "Demande en cours : réponse de l'adversaire ou de l'organisme dirigeant attendue. L'horaire officiel reste celui ci-dessus tant qu'elle n'est pas acceptée." },
  accepted_current: { tone: "success", text: "Dérogation acceptée : le match se joue à l'horaire officiel ci-dessus." },
  all_refused: { tone: "danger", text: "Demande(s) refusée(s) : l'horaire n'a pas changé, le match se joue à l'horaire officiel ci-dessus." },
  settled: { tone: "info", text: "Plus rien en attente. L'horaire en vigueur est l'horaire officiel ci-dessus." },
};

function officialSchedule(iso: string): string {
  const value = new Date(iso);
  const day = value.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = value.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).replace(":", "h");
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} à ${time}`;
}

function slotRange(iso: string): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const opts = { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" } as const;
  return `${start.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} ${start.toLocaleTimeString("fr-FR", opts)}–${end.toLocaleTimeString("fr-FR", opts)}`;
}

function demandeurTeam(d: OfficialDerogation): string | null {
  if (d.demandeur === "Domicile") return d.domicile;
  if (d.demandeur === "Visiteur") return d.visiteur;
  return null;
}

/**
 * Dérogations officielles FBI — copie de la liste du web : une carte par
 * match (historique complet), À venir / Archives, filtre par état et
 * « Conflits », action requise d'abord, accepter / refuser.
 */
export function OfficialDerogationsList({ derogations, respond, onChanged }: { derogations: OfficialDerogation[]; respond: (derogationId: string, body: { decision: "accepted" | "refused"; motifRefus: string | null }) => Promise<OfficialOutcome>; onChanged: () => void }) {
  const CONFLICTS = "__conflits__";
  const [selected, setSelected] = useState<string | null>(null);
  const [archives, setArchives] = useState(false);
  const [now] = useState(() => Date.now());
  const all = useMemo(() => groupDerogationsByMatch(derogations), [derogations]);
  const isPast = (g: DerogationMatchGroup) => (g.match.matchDatetime ? Date.parse(g.match.matchDatetime) < now : false);
  const archivedCount = all.filter(isPast).length;
  const groups = all.filter((g) => (archives ? isPast(g) && !g.actionRequired : !isPast(g) || g.actionRequired));
  const etatCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of groups) for (const etat of new Set(g.derogations.map((d) => d.etat).filter((e): e is string => Boolean(e)))) counts.set(etat, (counts.get(etat) ?? 0) + 1);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, "fr"));
  }, [groups]);
  const hasConflict = (g: DerogationMatchGroup) => g.derogations.some((d) => d.scheduleConflict);
  const filtered = selected === null ? groups : selected === CONFLICTS ? groups.filter(hasConflict) : groups.filter((g) => g.derogations.some((d) => d.etat === selected));

  if (derogations.length === 0) return <EmptyState icon="calendar-outline" title="Aucune dérogation connue" message="Aucune demande de dérogation n'a encore été récupérée depuis FBI pour ce club." />;

  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        <Filter active={!archives} count={all.length - archivedCount} label="À venir" onPress={() => (setArchives(false), setSelected(null))} />
        <Filter active={archives} count={archivedCount} label="Archives (matchs passés)" onPress={() => (setArchives(true), setSelected(null))} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Filter active={selected === null} count={groups.length} label="Tous les matchs" onPress={() => setSelected(null)} />
        <Filter active={selected === CONFLICTS} count={groups.filter(hasConflict).length} label="Conflits" onPress={() => setSelected(CONFLICTS)} />
        {etatCounts.map(([etat, count]) => (
          <Filter key={etat} active={selected === etat} count={count} label={etat} onPress={() => setSelected(etat)} />
        ))}
      </ScrollView>
      {filtered.length === 0 ? (
        <EmptyState icon="filter-outline" title={selected === CONFLICTS ? "Aucun conflit de créneau" : archives ? "Aucun match passé pour ce filtre" : "Aucun match à venir pour ce filtre"} message={archives ? "Choisis un autre filtre ci-dessus." : "Choisis un autre filtre, ou ouvre les archives (matchs passés)."} />
      ) : (
        filtered.map((g) => <MatchCard key={g.key} group={g} now={now} respond={respond} onChanged={onChanged} />)
      )}
    </View>
  );
}

function Filter({ active, count, label, onPress }: { active: boolean; count: number; label: string; onPress: () => void }) {
  const accent = useClubAccent();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.filter, active && { backgroundColor: accent.soft, borderColor: accent.accent }]}>
      <AppText variant="meta" color={active ? accent.text : colors.muted} style={styles.bold}>
        {label}
      </AppText>
      <View style={styles.countPill}>
        <AppText variant="meta" tone="muted">
          {String(count)}
        </AppText>
      </View>
    </Pressable>
  );
}

function MatchCard({ group, now, respond, onChanged }: { group: DerogationMatchGroup; now: number; respond: (id: string, body: { decision: "accepted" | "refused"; motifRefus: string | null }) => Promise<OfficialOutcome>; onChanged: () => void }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const { match, derogations } = group;
  const past = match.matchDatetime ? Date.parse(match.matchDatetime) < now : false;
  const verdict = VERDICT_COPY[derogationVerdict(group).kind];
  return (
    <View style={[styles.card, group.actionRequired && { borderColor: accent.accent }]}>
      <View style={styles.cardTop}>
        <AppText variant="bodyStrong" color={accent.text} style={styles.flex} onPress={() => router.push(`/c/${club.clubSlug}/matchs/${match.matchId}`)}>
          {`Rencontre ${match.numero ?? "?"}${(match.teamName ?? match.categoryLabel) ? ` (${match.teamName ?? match.categoryLabel})` : ""} — vs ${match.opponentName ?? "?"}`}
        </AppText>
        {group.actionRequired ? <Badge tone="warning" label="Action requise" /> : null}
      </View>
      <View style={styles.panel}>
        <AppText variant="eyebrow" tone="subtle">
          Horaire officiel actuel
        </AppText>
        <View style={styles.wrap}>
          <AppText variant="headline">{match.matchDatetime ? officialSchedule(match.matchDatetime) : "Date inconnue"}</AppText>
          {match.matchDatetime ? <Badge tone={past ? "neutral" : "info"} label={past ? "Match passé" : "À venir"} /> : null}
        </View>
        <Banner tone={verdict.tone} message={verdict.text} />
      </View>
      <AppText variant="eyebrow" tone="subtle">
        {derogations.length === 1 ? "La dérogation" : `Historique : ${derogations.length} dérogations`}
      </AppText>
      {derogations.map((d, i) => (
        <Entry key={d.id ?? i} derogation={d} current={isRetainedSchedule(d)} replacedOn={isRetainedSchedule(d) ? null : supersededBy(d, derogations)} respond={respond} onChanged={onChanged} />
      ))}
    </View>
  );
}

function Entry({ derogation: d, current, replacedOn, respond, onChanged }: { derogation: OfficialDerogation; current: boolean; replacedOn: string | null; respond: (id: string, body: { decision: "accepted" | "refused"; motifRefus: string | null }) => Promise<OfficialOutcome>; onChanged: () => void }) {
  const [open, setOpen] = useState(d.actionRequired);
  const team = demandeurTeam(d);
  const detail = hasDerogationDetail(d);
  const changes = describeRequestedChanges(d);
  const changesText = changes.length ? changes.join(" · ") : detail ? (changesKnown(d) ? "Aucun changement coché sur FBI" : "Changement non précisé") : "Détail non récupéré sur FBI";
  const requester = d.demandeur ? `${team ?? d.demandeur}` : null;
  const rows: [string, string][] = [
    ["État", d.etat ?? "—"],
    ["Demandeur", `${d.demandeur ?? "—"}${team ? ` (${team})` : ""}`],
    ["Date de dépôt", d.dateDepot ?? "—"],
    ["Changements demandés", changesText],
    ["Rencontre du", d.dateRencontre ?? "—"],
    ["Motif de la demande", d.motif ?? "—"],
    ["Dernière vérification", d.checkedAt ? new Date(d.checkedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "—"],
  ];
  const answer: [string, string][] = [
    ["Adversaire", d.adversaire ?? "—"],
    ["Date de réponse", d.dateReponse ?? "—"],
    ["Acceptation", d.acceptation ?? "—"],
    ["Motif de refus", d.motifRefus ?? "—"],
  ];
  return (
    <View style={styles.entry}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.entryHead}>
        <View style={styles.wrap}>
          <Badge tone={ETAT_TONE[etatTone(d.etat)]} label={d.etat ?? "État inconnu"} />
          {current ? <Badge tone="info" label="Horaire retenu" /> : replacedOn ? <Badge label={`Remplacée le ${replacedOn.split(" ")[0]}`} /> : null}
          {d.actionRequired ? <Badge tone="warning" label="Action requise" /> : null}
        </View>
        <AppText variant="bodyStrong">{changesText}</AppText>
        <AppText variant="meta" tone="muted">{`${d.dateDepot ? `Déposée le ${d.dateDepot}` : "Date de dépôt inconnue"}${requester ? ` par ${requester}` : ""}${d.motif ? ` · « ${d.motif} »` : ""}`}</AppText>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.subtle} style={styles.chevron} />
      </Pressable>
      {open ? (
        <View style={styles.entryBody}>
          {d.scheduleConflict ? (
            <Banner tone="danger" message={`Conflit de créneau (un créneau de match dure 2h) : un match ${d.scheduleConflict.teamName ? `de l'équipe ${d.scheduleConflict.teamName} ` : ""}est déjà prévu sur le créneau ${slotRange(d.scheduleConflict.matchDatetime)} — Rencontre ${d.scheduleConflict.numero ?? "?"} vs ${d.scheduleConflict.opponentName ?? "?"}.`} />
          ) : null}
          {d.actionRequired && d.id ? <RespondToDerogation submit={(body) => respond(d.id!, body)} onDone={onChanged} /> : null}
          {!detail ? <Banner tone="info" message="Le détail de cette dérogation (demandeur, motif, horaire demandé, réponse) n'a pas été récupéré sur FBI : seules les informations du tableau des dérogations sont connues." /> : null}
          <DataRows rows={rows} />
          {d.adversaire || d.dateReponse || d.acceptation || d.motifRefus ? (
            <>
              <AppText variant="eyebrow" tone="subtle">
                Réponse de l&apos;adversaire
              </AppText>
              <DataRows rows={answer} />
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DataRows({ rows }: { rows: [string, string][] }) {
  return (
    <View style={styles.rows}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.dataRow}>
          <AppText variant="meta" tone="subtle">
            {label}
          </AppText>
          <AppText variant="callout">{value}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  venues: { gap: spacing.xs, paddingBottom: spacing.sm },
  venue: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  venueSelected: { borderColor: colors.foreground, backgroundColor: colors.surfaceMuted },
  gap: { gap: spacing.md },
  start: { alignSelf: "flex-start" },
  flex: { flex: 1 },
  bold: { fontWeight: "600" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  panel: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  box: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.md, gap: spacing.xs, paddingVertical: spacing.xs },
  toggle: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: spacing.md },
  filters: { gap: spacing.sm, paddingVertical: 2 },
  filter: { flexDirection: "row", alignItems: "center", gap: spacing.sm, height: 40, paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  countPill: { paddingHorizontal: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  card: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, ...shadows.card },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  entry: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, overflow: "hidden" },
  entryHead: { gap: spacing.xs, padding: spacing.md, paddingRight: spacing.xxl },
  chevron: { position: "absolute", right: spacing.md, top: spacing.md },
  entryBody: { gap: spacing.md, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rows: { gap: spacing.sm },
  dataRow: { gap: 2 },
});
