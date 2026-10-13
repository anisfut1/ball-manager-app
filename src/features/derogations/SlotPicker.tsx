import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { derogationsApi, type CandidateSlot, type ClubVenue, type DerogationAvailability } from "@/api/endpoints/derogations";
import { ApiError, humanMessage } from "@/api/errors";
import { useActiveClub } from "@/auth/SessionProvider";
import { AppText, Banner, Button, CardSkeletons, EmptyState, ErrorState, TextField } from "@/components/ui";
import { colors, radius, shadows, spacing } from "@/design";
import { useClubAccent } from "@/design/ClubTheme";
import { zonedToUtcIso } from "@/lib/dates";
import { AWAY_NOTICE, formatTime, localDateKey, PENDING_WARNING, upcomingWeekendDays } from "./labels";

export interface SlotSelection {
  venueId: string | null;
  venueName: string | null;
  startAt: string;
  endAt: string;
  localStart: string;
  localEnd: string;
  warnings: CandidateSlot["warnings"];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ROW = 48; // hauteur d'une heure — cibles tactiles ≥ 44 pt

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** « Conflit avec U15M vs Montpellier, 16:00–18:00. » (texte du web) */
export function conflictText(slot: CandidateSlot, localTime: (iso: string) => string): string {
  const c = slot.conflicts[0];
  if (!c) return slot.available ? "" : "Créneau déjà passé.";
  const who = [c.teamName, c.opponentName ? `vs ${c.opponentName}` : null].filter(Boolean).join(" ") || "un match";
  const prefix = c.type === "TEAM_MATCH" ? "L'équipe joue déjà" : "Conflit avec";
  return `${prefix} ${who}, ${localTime(c.startAt)}–${localTime(c.endAt)}.`;
}

/** Étape « Date » : samedis et dimanches à venir, puis « Autre date » (jour de semaine possible). */
export function DateChooser({ timezone, value, onChange }: { timezone: string; value: string | null; onChange: (date: string) => void }) {
  const accent = useClubAccent();
  const [now] = useState(() => new Date());
  const days = useMemo(() => upcomingWeekendDays(now, timezone, 6), [now, timezone]);
  const isOther = value !== null && !days.some((d) => d.date === value);
  const [showOther, setShowOther] = useState(isOther);
  const [typed, setTyped] = useState(isOther && value ? value : "");
  const tomorrow = useMemo(() => {
    const [y, m, d] = localDateKey(now, timezone).split("-").map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }, [now, timezone]);
  const typedProblem = typed && (!DATE.test(typed) ? "Format AAAA-MM-JJ." : typed < tomorrow ? "Choisis une date à venir." : null);

  return (
    <View style={styles.gap}>
      <View style={styles.days} accessibilityLabel="Week-ends à venir">
        {days.map((d) => {
          const active = value === d.date;
          return (
            <Pressable
              key={d.date}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={d.label}
              onPress={() => {
                setShowOther(false);
                onChange(d.date);
              }}
              style={[styles.day, active && { backgroundColor: accent.accent, borderColor: accent.accent }]}
            >
              <AppText variant="meta" color={active ? accent.ink : colors.subtle} style={styles.dayTop}>
                {d.weekday}
              </AppText>
              <AppText variant="headline" color={active ? accent.ink : colors.foreground}>
                {d.day}
              </AppText>
              <AppText variant="meta" color={active ? accent.ink : colors.muted} style={styles.dayTop}>
                {d.month}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {showOther || isOther ? (
        <View style={styles.gap}>
          <TextField
            label="Autre date (AAAA-MM-JJ)"
            hint="Un jour de semaine reste possible : la plage horaire n'est alors pas imposée."
            value={typed}
            onChangeText={(v) => {
              setTyped(v);
              if (DATE.test(v) && v >= tomorrow) onChange(v);
            }}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            error={typedProblem || null}
          />
        </View>
      ) : (
        <Button label="Choisir une date en semaine / Autre date" variant="ghost" icon={<Ionicons name="calendar-outline" size={18} color={colors.foreground} />} onPress={() => setShowOther(true)} style={styles.start} />
      )}
    </View>
  );
}

/** Étape « Créneau » : planning des gymnases (domicile) ou heures (extérieur), puis « Choisir une autre heure ». */
export function SlotChooser({ as, matchId, date, timezone, venues, value, onChange }: { as: string; matchId: string; date: string; timezone: string; venues: ClubVenue[]; value: SlotSelection | null; onChange: (s: SlotSelection | null) => void }) {
  const club = useActiveClub();
  const q = useQuery({ queryKey: ["derogation-availability", club.clubSlug, matchId, date], queryFn: () => derogationsApi.availability(club.clubSlug, as, matchId, date), staleTime: 0 });
  const localTime = (iso: string) => formatTime(iso, timezone);

  if (q.error) return <ErrorState title="Disponibilités indisponibles" message={humanMessage(q.error)} onRetry={() => void q.refetch()} />;
  if (!q.data) return <CardSkeletons count={2} />;
  const a = q.data;
  const home = a.matchType === "HOME";
  const noRule = a.rules.earliestStart === null;

  return (
    <View style={styles.gap}>
      {home ? null : <Banner tone="info" message={AWAY_NOTICE} />}
      {home && noRule ? <Banner tone="info" message="Aucune plage horaire n'est définie par le club pour ce jour : choisis l'heure qui convient, les conflits restent vérifiés." /> : null}
      {home && !noRule ? (
        <AppText variant="meta" tone="muted">{`Plage du club ce jour-là : ${a.rules.earliestStart} → ${a.rules.latestStart} (début du match) · durée prise en compte : ${a.rules.durationMinutes / 60} h.`}</AppText>
      ) : null}
      {home ? (
        a.venues.length === 0 ? (
          <EmptyState icon="business-outline" title="Aucun gymnase actif" message="L'administrateur du club doit activer au moins un gymnase (Administration → Membres & gymnases)." />
        ) : (
          <VenuePlanning availability={a} selected={value} onSelect={onChange} localTime={localTime} />
        )
      ) : a.awayCandidateStartTimes.length === 0 ? (
        <AppText variant="meta" tone="muted">
          Aucune heure suggérée ce jour-là : choisis une heure précise ci-dessous.
        </AppText>
      ) : (
        <AwaySlots slots={a.awayCandidateStartTimes} selected={value} onSelect={onChange} />
      )}
      {value && value.warnings.length > 0 ? <Banner tone="warning" message={`${PENDING_WARNING} Le coordinateur arbitrera.`} /> : null}
      <CustomTime key={date} as={as} matchId={matchId} date={date} timezone={timezone} venues={home ? (a.venues.length ? a.venues.map((v) => v.venue) : venues) : []} home={home} onSelect={onChange} />
    </View>
  );
}

/**
 * Planning des gymnases — une timeline verticale par gymnase (comme le web) :
 * match programmé = carte pleine sur sa durée ; demande en cours = contour
 * pointillé ; créneau libre = « Choisir » ; impossible = raison au toucher.
 */
function VenuePlanning({ availability, selected, onSelect, localTime }: { availability: DerogationAvailability; selected: SlotSelection | null; onSelect: (s: SlotSelection) => void; localTime: (iso: string) => string }) {
  const accent = useClubAccent();
  const [explained, setExplained] = useState<string | null>(null);
  const gridStart = minutes(availability.rules.gridStart);
  const gridEnd = minutes(availability.rules.gridEnd) + availability.rules.durationMinutes;
  const hours: number[] = [];
  for (let m = Math.floor(gridStart / 60) * 60; m <= gridEnd; m += 60) hours.push(m);
  const height = ((gridEnd - gridStart) / 60) * ROW;
  const top = (hhmm: string) => ((minutes(hhmm) - gridStart) / 60) * ROW;
  const block = (availability.rules.durationMinutes / 60) * ROW;

  return (
    <View style={styles.gap}>
      <View style={styles.legend}>
        <Legend swatch={styles.swFree} label="Libre" />
        <Legend swatch={styles.swMatch} label="Match programmé" />
        <Legend swatch={styles.swPending} label="Demande en cours" />
        <Legend swatch={[styles.swSel, { borderColor: accent.accent }]} label="Ta sélection" />
      </View>
      {explained ? <Banner tone="warning" message={explained} /> : null}
      {availability.venues.map((lane) => {
        const free = lane.candidateStartTimes.filter((c) => c.available).length;
        return (
          <View key={lane.venue.id} style={styles.lane} accessibilityLabel={lane.venue.name}>
            <View style={styles.laneHead}>
              <Ionicons name="location-outline" size={16} color={accent.text} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{lane.venue.name}</AppText>
                <AppText variant="meta" tone="muted">{`${lane.existingMatches.length} match${lane.existingMatches.length > 1 ? "s" : ""} programmé${lane.existingMatches.length > 1 ? "s" : ""} · ${free} créneau${free > 1 ? "x" : ""} libre${free > 1 ? "s" : ""}`}</AppText>
              </View>
            </View>
            <View style={styles.timeline}>
              <View style={[styles.scale, { height }]}>
                {hours.map((m) => (
                  <AppText key={m} variant="meta" tone="subtle" style={[styles.hour, { top: ((m - gridStart) / 60) * ROW - 8 }]}>
                    {`${String(Math.floor(m / 60)).padStart(2, "0")}:00`}
                  </AppText>
                ))}
              </View>
              <View style={[styles.track, { height }]}>
                {hours.map((m) => (
                  <View key={m} style={[styles.line, { top: ((m - gridStart) / 60) * ROW }]} />
                ))}
                {lane.candidateStartTimes.map((slot) => {
                  const isSel = selected?.venueId === lane.venue.id && selected.startAt === slot.startAt;
                  const reason = conflictText(slot, localTime);
                  return (
                    <View key={slot.startAt} style={[styles.slotWrap, { top: top(slot.localStart) + 2, height: ROW - 4 }]}>
                      {slot.available ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSel }}
                          accessibilityLabel={`${lane.venue.name}, ${slot.localStart} à ${slot.localEnd}, disponible${slot.warnings.length ? ", une autre demande vise ce créneau" : ""}`}
                          onPress={() => {
                            setExplained(null);
                            onSelect({ venueId: lane.venue.id, venueName: lane.venue.name, startAt: slot.startAt, endAt: slot.endAt, localStart: slot.localStart, localEnd: slot.localEnd, warnings: slot.warnings });
                          }}
                          style={[styles.slot, isSel ? { backgroundColor: accent.soft, borderColor: accent.accent } : styles.slotFree]}
                        >
                          <AppText variant="callout" style={styles.bold}>{`${slot.localStart} → ${slot.localEnd}`}</AppText>
                          <AppText variant="meta" color={isSel ? accent.text : colors.muted} style={styles.bold}>
                            {isSel ? "Choisi" : "Choisir"}
                          </AppText>
                        </Pressable>
                      ) : (
                        <Pressable accessibilityRole="button" accessibilityLabel={`${lane.venue.name}, ${slot.localStart}, indisponible. ${reason}`} onPress={() => setExplained(`${slot.localStart} → ${slot.localEnd} — ${reason || "créneau indisponible."}`)} style={[styles.slot, styles.slotOff]}>
                          <AppText variant="meta" tone="subtle">{`${slot.localStart}  Indisponible`}</AppText>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
                {lane.pendingRequests.map((p) => (
                  <View key={p.requestId} pointerEvents="none" style={[styles.pending, { top: top(p.localStart) + 2, height: block - 4 }]}>
                    <View style={styles.pendingTag}>
                      <AppText variant="meta" tone="warning">{`Demande en cours${p.teamName ? ` · ${p.teamName}` : ""}`}</AppText>
                    </View>
                  </View>
                ))}
                {lane.existingMatches
                  .filter((m) => minutes(m.localEnd) > gridStart || minutes(m.localEnd) < minutes(m.localStart))
                  .map((m) => {
                    const t = Math.max(0, top(m.localStart));
                    return (
                      <View key={m.matchId} pointerEvents="none" style={[styles.match, { top: t + 2, height: Math.min(block, height - t) - 4 }]}>
                        <AppText variant="callout" numberOfLines={1} style={styles.bold}>
                          {`${m.teamName ?? "Match"}${m.opponentName ? ` vs ${m.opponentName}` : ""}`}
                        </AppText>
                        <AppText variant="meta" tone="muted">{`${m.localStart} → ${m.localEnd}`}</AppText>
                      </View>
                    );
                  })}
                {selected?.venueId === lane.venue.id ? <View pointerEvents="none" style={[styles.selection, { borderColor: accent.accent, top: top(selected.localStart) + 2, height: block - 4 }]} /> : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Legend({ swatch, label }: { swatch: object; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, swatch]} />
      <AppText variant="meta" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

/** Match à l'extérieur : liste d'heures (seul le conflit d'équipe compte). */
function AwaySlots({ slots, selected, onSelect }: { slots: CandidateSlot[]; selected: SlotSelection | null; onSelect: (s: SlotSelection) => void }) {
  const accent = useClubAccent();
  return (
    <View style={styles.away}>
      {slots.map((slot) => {
        const isSel = selected?.startAt === slot.startAt;
        return (
          <Pressable
            key={slot.startAt}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel, disabled: !slot.available }}
            disabled={!slot.available}
            onPress={() => onSelect({ venueId: null, venueName: null, startAt: slot.startAt, endAt: slot.endAt, localStart: slot.localStart, localEnd: slot.localEnd, warnings: [] })}
            style={[styles.awaySlot, isSel && { backgroundColor: accent.soft, borderColor: accent.accent }, !slot.available && styles.disabled]}
          >
            <AppText variant="callout" color={isSel ? accent.text : colors.foreground} style={styles.bold}>
              {slot.localStart}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** « Choisir une autre heure » : validée par l'API (mêmes règles que l'envoi). */
function CustomTime({ as, matchId, date, timezone, venues, home, onSelect }: { as: string; matchId: string; date: string; timezone: string; venues: ClubVenue[]; home: boolean; onSelect: (s: SlotSelection) => void }) {
  const club = useActiveClub();
  const accent = useClubAccent();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);

  if (!open) return <Button label="Choisir une autre heure" variant="ghost" icon={<Ionicons name="time-outline" size={18} color={colors.foreground} />} onPress={() => setOpen(true)} style={styles.start} />;

  async function check() {
    if (!TIME.test(time)) return setMessage({ tone: "danger", text: "Heure au format HH:MM." });
    setChecking(true);
    setMessage(null);
    try {
      const result = await derogationsApi.checkSlot(club.clubSlug, as, matchId, zonedToUtcIso(date, time, timezone), home ? venueId || null : null);
      if (!result.ok) return setMessage({ tone: "danger", text: result.message ?? "Créneau impossible." });
      const venue = venues.find((v) => v.id === venueId) ?? null;
      onSelect({ venueId: home ? (venue?.id ?? null) : null, venueName: home ? (venue?.name ?? null) : null, startAt: result.startAt, endAt: result.endAt, localStart: formatTime(result.startAt, timezone), localEnd: formatTime(result.endAt, timezone), warnings: result.warnings });
      setMessage({ tone: "success", text: `Créneau disponible : ${formatTime(result.startAt, timezone)} → ${formatTime(result.endAt, timezone)}${venue && home ? ` — ${venue.name}` : ""}.` });
    } catch (err) {
      setMessage({ tone: "danger", text: err instanceof ApiError ? err.message : "Vérification impossible pour le moment." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.panel}>
      <AppText variant="bodyStrong">Choisir une autre heure</AppText>
      <TextField label="Heure de début (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" maxLength={5} />
      {home && venues.length > 0 ? (
        <View style={styles.venues} accessibilityRole="radiogroup" accessibilityLabel="Gymnase">
          {venues.map((v) => (
            <Pressable key={v.id} accessibilityRole="radio" accessibilityState={{ selected: venueId === v.id }} onPress={() => setVenueId(v.id)} style={[styles.venue, venueId === v.id && { borderColor: accent.accent, backgroundColor: accent.soft }]}>
              <AppText variant="callout">{v.name}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Button label="Vérifier ce créneau" variant="secondary" loading={checking} disabled={!time} onPress={() => void check()} />
      {message ? <Banner tone={message.tone} message={message.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  start: { alignSelf: "flex-start" },
  flex: { flex: 1 },
  bold: { fontWeight: "600" },
  days: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  day: { width: "22.5%", height: 72, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, ...shadows.card },
  dayTop: { fontWeight: "600", letterSpacing: 0.8, fontSize: 10.5 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 20, height: 12, borderRadius: 4 },
  swFree: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  swMatch: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
  swPending: { borderWidth: 2, borderStyle: "dashed", borderColor: colors.warning },
  swSel: { borderWidth: 2 },
  lane: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surfaceRaised, overflow: "hidden", ...shadows.card },
  laneHead: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  timeline: { flexDirection: "row", paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  scale: { width: 48, position: "relative" },
  hour: { position: "absolute", left: 0, fontSize: 11 },
  track: { flex: 1, position: "relative" },
  line: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed", borderColor: colors.border },
  slotWrap: { position: "absolute", left: 2, right: 2 },
  slot: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1 },
  slotFree: { backgroundColor: colors.surface, borderColor: "transparent" },
  slotOff: { backgroundColor: colors.surfaceMuted, borderColor: "transparent" },
  pending: { position: "absolute", left: 2, right: 2, zIndex: 5, borderRadius: 10, borderWidth: 2, borderStyle: "dashed", borderColor: colors.warning },
  pendingTag: { position: "absolute", right: 6, top: 4, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: colors.warningSoft },
  match: { position: "absolute", left: 2, right: 2, zIndex: 10, justifyContent: "center", gap: 2, paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceRaised, ...shadows.card },
  selection: { position: "absolute", left: 2, right: 2, zIndex: 20, borderRadius: 10, borderWidth: 2 },
  away: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  awaySlot: { width: "31%", height: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  disabled: { opacity: 0.45 },
  panel: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  venues: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  venue: { minHeight: 44, paddingHorizontal: spacing.md, justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong },
});
