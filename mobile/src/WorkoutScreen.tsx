import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useColorScheme, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MAX_ADJUSTABLE_SETUPS, adjustableSetups, isAdjustable } from "@/lib/adjustable";
import { getExercise, unitLabel, weightLabel } from "@/lib/exercises";
import { describePlates, warmupSets } from "@/lib/plates";
import { FEELS } from "@/lib/feel";
import { applyFeel, exerciseHistory } from "@/lib/progression";
import { bests, isLivePr } from "@/lib/records";
import { linkNext, nextUp, restAfter, restSeconds, supersetBlocker, supersetLabel, unlink } from "@/lib/superset";
import type { Entry, Feel, SetLog, Workout } from "@/lib/types";
import { DemoSheet } from "./DemoSheet";
import { saveDemosForOffline } from "./demos";
import type { HrUpdate } from "./heartRate";
import { endRest as endLockScreenRest, showRest } from "./restActivity";
import { onSyncChange, pendingCount, saveWorkout } from "./store";

/**
 * The native workout screen: Hevy-style set rows, big tap targets, haptics, a full-screen rest
 * timer with a lock-screen alert, and it all works with no signal. Swapping or adding exercises
 * hands over to the full website view.
 */

export const THEME = {
  light: { bg: "#f4f6f5", card: "#ffffff", card2: "#eef1ef", line: "#dde3df", text: "#101814", muted: "#66706b", accent: "#0b4d34", accentInk: "#ffffff", accentSoft: "rgba(11,77,52,0.10)", danger: "#c0392b", warn: "#b7791f", hero: "#0b4d34" },
  dark: { bg: "#0a0f0c", card: "#121a15", card2: "#1a241e", line: "#24302a", text: "#eef2ec", muted: "#8f9b93", accent: "#3cc47f", accentInk: "#06140c", accentSoft: "rgba(60,196,127,0.14)", danger: "#ff6b5b", warn: "#f0b44c", hero: "#0f3d2a" },
};
export type Theme = (typeof THEME)["light"];
export const useTheme = (): Theme => THEME[useColorScheme() === "dark" ? "dark" : "light"];

Notifications.setNotificationHandler({
  // In front, the screen itself buzzes; the banner is for when the phone is locked or in a pocket.
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
});

type Rest = { endsAt: number; total: number; ei: number; si: number };
type Editing = { ei: number; si: number; field: "weight" | "reps"; thenComplete?: boolean };


const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function WorkoutScreen({
  initial,
  history,
  hr,
  onFinish,
  onDiscard,
  onOpenWeb,
}: {
  initial: Workout;
  history: Workout[];
  hr: HrUpdate | null;
  onFinish: (w: Workout) => void;
  onDiscard: (w: Workout) => void;
  /** Swap, add or anything else the full website view does. */
  onOpenWeb: (w: Workout) => void;
}) {
  useKeepAwake("workout");
  const c = useTheme();
  const gutter = useGutter();
  const [w, setW] = useState(initial);
  const [rest, setRest] = useState<Rest | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [pending, setPending] = useState(0);
  const [demo, setDemo] = useState<string | null>(null);
  const latest = useRef(w);
  const notif = useRef<string | null>(null);

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
    pendingCount().then(setPending);
    saveDemosForOffline(initial.entries.map((e) => e.exerciseId));
    const off = onSyncChange(setPending);
    return () => {
      off();
      if (notif.current) Notifications.cancelScheduledNotificationAsync(notif.current).catch(() => {});
    };
  }, []);

  // Mirror the rest timer on the Lock Screen and Dynamic Island.
  const restUpNext = rest ? upNextText(w) : "";
  useEffect(() => {
    if (!rest) return endLockScreenRest();
    showRest({ startsAt: rest.endsAt - rest.total * 1000, endsAt: rest.endsAt, upNext: restUpNext });
  }, [rest, restUpNext]);
  useEffect(() => endLockScreenRest, []);

  /** Every change is saved on the phone straight away and synced in the background. */
  const update = useCallback((fn: (w: Workout) => Workout) => {
    const next = fn(latest.current);
    latest.current = next;
    setW(next);
    saveWorkout(next);
    return next;
  }, []);
  const updateEntry = (i: number, fn: (e: Entry) => Entry) => update((x) => ({ ...x, entries: x.entries.map((e, j) => (j === i ? fn(e) : e)) }));

  function changeSet(ei: number, si: number, patch: Partial<SetLog>) {
    updateEntry(ei, (e) => {
      const sets = e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s));
      // Carry a changed weight forward to later sets that haven't been done yet.
      if (patch.weight !== undefined) {
        const old = e.sets[si].weight;
        for (let j = si + 1; j < sets.length; j++) if (!sets[j].done && sets[j].weight === old) sets[j] = { ...sets[j], weight: patch.weight };
      }
      return { ...e, sets };
    });
  }

  const scheduleRestAlert = useCallback(async (endsAt: number, upNext: string) => {
    if (notif.current) await Notifications.cancelScheduledNotificationAsync(notif.current).catch(() => {});
    notif.current = null;
    const seconds = Math.round((endsAt - Date.now()) / 1000);
    if (seconds < 1) return;
    try {
      notif.current = await Notifications.scheduleNotificationAsync({
        content: { title: "Rest done", body: upNext || "Time for your next set", sound: true, interruptionLevel: "timeSensitive" },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
      });
    } catch {
      // Notifications not allowed: the on-screen timer still runs.
    }
  }, []);

  const endRest = useCallback(() => {
    if (notif.current) Notifications.cancelScheduledNotificationAsync(notif.current).catch(() => {});
    notif.current = null;
    setRest(null);
  }, []);

  function toggleDone(ei: number, si: number, weight?: number) {
    const e = latest.current.entries[ei];
    const s = e.sets[si];
    const done = !s.done;
    const ex = getExercise(e.exerciseId);
    // A loaded exercise ticked without a weight can't progress next time, so ask for the weight first.
    if (done && weight === undefined && s.weight == null && ex && weightLabel(ex)) {
      setEditing({ ei, si, field: "weight", thenComplete: true });
      return;
    }
    const next = update((x) => ({
      ...x,
      entries: x.entries.map((en, j) =>
        j !== ei ? en : { ...en, sets: en.sets.map((st, k) => (k !== si ? st : { ...st, done, reps: st.reps ?? en.goalReps ?? en.target.repMin, ...(weight !== undefined ? { weight } : {}), ...(done ? {} : { feel: undefined }) })) },
      ),
    }));
    const pr = done && isLivePr(next.entries[ei], si, bests(history, e.exerciseId, next.id));
    Haptics.notificationAsync(done ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    if (pr) setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 250);
    if (!done) {
      if (rest?.ei === ei && rest.si === si) endRest();
      return;
    }
    // In a superset, go straight to the partner exercise; rest after the round.
    const sec = restSeconds(next, ei);
    if (!restAfter(next, ei, si)) endRest();
    else if (sec > 0) {
      const endsAt = Date.now() + sec * 1000;
      setRest({ endsAt, total: sec, ei, si });
      scheduleRestAlert(endsAt, upNextText(next));
    }
  }

  function finish() {
    const unticked = w.entries.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    const go = () => {
      endRest();
      const done = update((x) => ({ ...x, finishedAt: new Date().toISOString() }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onFinish(done);
    };
    if (unticked === 0) return go();
    Alert.alert("Finish workout?", `${unticked} ${unticked === 1 ? "set isn't" : "sets aren't"} ticked and won't count.`, [
      { text: "Keep going", style: "cancel" },
      { text: "Finish", onPress: go },
    ]);
  }

  function discard() {
    Alert.alert("Discard this workout?", "Everything logged in it will be deleted.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          endRest();
          onDiscard(latest.current);
        },
      },
    ]);
  }

  const doneSets = w.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const up = nextUp(w);
  const setups = adjustableSetups(w.entries);

  return (
    <SafeAreaView style={[s.fill, { backgroundColor: c.bg }]} edges={["top"]}>
      <View style={[s.header, { borderColor: c.line, backgroundColor: c.bg, paddingHorizontal: gutter }]}>
        <View style={{ flex: 1 }}>
          <Text style={[s.h1, { color: c.text }]} numberOfLines={1}>
            {w.name}
          </Text>
          <Text style={[s.small, { color: c.muted }]}>
            <Elapsed since={w.startedAt} /> · {doneSets} {doneSets === 1 ? "set" : "sets"}
          </Text>
          <HeartRate hr={hr} c={c} />
        </View>
        <Pressable onPress={finish} disabled={doneSets === 0} style={[s.finish, { backgroundColor: c.accent, opacity: doneSets === 0 ? 0.4 : 1 }]}>
          <Text style={{ color: c.accentInk, fontSize: 17, fontWeight: "700" }}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingHorizontal: gutter, gap: 14, paddingBottom: rest ? 140 : 48 }} keyboardShouldPersistTaps="handled">
        {setups.length > 0 && (
          <Text style={[s.small, { color: setups.length > MAX_ADJUSTABLE_SETUPS ? c.warn : c.muted }]}>
            Dumbbell/kettlebell set-ups: {setups.length} of {MAX_ADJUSTABLE_SETUPS}
            {setups.length > MAX_ADJUSTABLE_SETUPS ? " · over your limit" : ""} ·{" "}
            {setups.map((x) => (x.weight != null ? `${x.weight} kg ${x.load}` : `${x.load} (weight not set)`)).join(", then ")}
          </Text>
        )}
        {pending > 0 && <Text style={[s.small, { color: c.muted }]}>Saved on this phone. It syncs when you have signal.</Text>}

        {w.entries.map((e, ei) => (
          <EntryCard
            key={`${e.exerciseId}-${ei}`}
            c={c}
            entry={e}
            last={exerciseHistory(history, e.exerciseId)[0]?.sets}
            nextSi={up?.ei === ei ? up.si : -1}
            superset={supersetLabel(w.entries, ei)}
            past={bests(history, e.exerciseId, w.id)}
            onNote={() =>
              Alert.prompt(
                "Note for this exercise",
                "Shows every time you do it, e.g. seat on notch 4.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Save", onPress: (t?: string) => updateEntry(ei, (x) => ({ ...x, note: (t ?? "").trim() })) },
                ],
                "plain-text",
                e.note ?? "",
              )
            }
            onSuperset={() => {
              tap();
              if (w.entries[ei].group) return update((x) => ({ ...x, entries: unlink(x.entries, ei) }));
              const why = supersetBlocker(w.entries, ei);
              if (why) return Alert.alert("Can't superset", why);
              update((x) => ({ ...x, entries: linkNext(x.entries, ei) }));
            }}
            onEdit={(si, field) => setEditing({ ei, si, field })}
            onToggle={(si) => toggleDone(ei, si)}
            onFeel={(si, f) => {
              tap();
              updateEntry(ei, (x) => applyFeel(x, si, f));
            }}
            onAddSet={() => {
              tap();
              updateEntry(ei, (x) => ({ ...x, sets: [...x.sets, { weight: x.sets.at(-1)?.weight ?? null, reps: null, done: false }] }));
            }}
            onRemoveSet={() => {
              tap();
              updateEntry(ei, (x) => ({ ...x, sets: x.sets.slice(0, -1) }));
            }}
            onSwap={() => onOpenWeb(latest.current)}
            onDemo={() => {
              tap();
              setDemo(e.exerciseId);
            }}
          />
        ))}

        <Pressable onPress={() => onOpenWeb(latest.current)} style={[s.wide, { borderColor: c.line, backgroundColor: c.card }]}>
          <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>+ Add or swap exercises</Text>
        </Pressable>
        <Pressable onPress={discard} style={[s.wide, { borderColor: c.line }]}>
          <Text style={{ color: c.danger, fontSize: 16 }}>Discard workout</Text>
        </Pressable>
      </ScrollView>

      {rest && (
        <RestOverlay
          c={c}
          rest={rest}
          workout={w}
          onAdd={(sec) => {
            tap();
            const next = { ...rest, endsAt: Math.max(Date.now(), rest.endsAt + sec * 1000), total: Math.max(1, rest.total + sec) };
            setRest(next);
            scheduleRestAlert(next.endsAt, upNextText(latest.current));
          }}
          onFeel={(f) => {
            tap();
            const next = updateEntry(rest.ei, (x) => applyFeel(x, rest.si, f));
            scheduleRestAlert(rest.endsAt, upNextText(next));
          }}
          onDone={endRest}
        />
      )}

      {demo && <DemoSheet c={c} exerciseId={demo} onClose={() => setDemo(null)} />}

      {editing && <SetSheet key={`${editing.ei}-${editing.si}-${editing.field}`} c={c} workout={w} editing={editing} onClose={() => setEditing(null)} onDone={(v) => {
        if (editing.thenComplete) toggleDone(editing.ei, editing.si, v);
        else changeSet(editing.ei, editing.si, editing.field === "weight" ? { weight: v } : { reps: v });
        setEditing(null);
      }} />}
    </SafeAreaView>
  );
}

/** The next set to do, e.g. "Bench Press · set 3 · 60 kg × 8". */
function nextSet(w: Workout) {
  const up = nextUp(w);
  if (up) {
    const { ei, si } = up;
    const e = w.entries[ei];
    const ex = getExercise(e.exerciseId);
    const set = e.sets[si];
    const reps = set.reps ?? e.goalReps ?? e.target.repMin;
    const unit = ex ? unitLabel(ex.unit) : "reps";
    const load = set.weight != null && ex && weightLabel(ex) ? `${set.weight} ${weightLabel(ex)} × ` : "";
    return { ei, si, name: ex?.name ?? e.exerciseId, detail: `Set ${si + 1} · ${load}${reps} ${unit}` };
  }
  return null;
}
function upNextText(w: Workout) {
  const n = nextSet(w);
  return n ? `Up next: ${n.name}, ${n.detail.toLowerCase()}` : "Last set done. Tap Finish when you're ready.";
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  return <>{Math.max(0, Math.floor((now - Date.parse(since)) / 60000))} min</>;
}

function HeartRate({ hr, c }: { hr: HrUpdate | null; c: Theme }) {
  if (!hr) return null;
  const text =
    hr.status === "connected"
      ? hr.bpm != null
        ? `${hr.bpm} bpm`
        : `${hr.device ?? "Strap"} connected`
      : hr.status === "searching"
        ? "Looking for heart rate strap…"
        : hr.status === "bluetooth-off"
          ? (hr.message ?? "Turn on Bluetooth")
          : hr.status === "error"
            ? "Heart rate strap unavailable"
            : null;
  if (!text) return null;
  const live = hr.bpm != null;
  return (
    <Text style={{ marginTop: 2, fontSize: live ? 16 : 13, fontWeight: live ? "700" : "400", color: live ? c.text : c.muted, fontVariant: ["tabular-nums"] }}>
      <Text style={{ color: live ? c.danger : c.muted }}>♥ </Text>
      {text}
    </Text>
  );
}

function EntryCard({
  c,
  entry,
  last,
  nextSi,
  superset,
  past,
  onNote,
  onSuperset,
  onEdit,
  onToggle,
  onFeel,
  onAddSet,
  onRemoveSet,
  onSwap,
  onDemo,
}: {
  c: Theme;
  entry: Entry;
  last?: SetLog[];
  nextSi: number;
  superset: string | null;
  past: ReturnType<typeof bests>;
  onNote: () => void;
  onSuperset: () => void;
  onEdit: (si: number, field: "weight" | "reps") => void;
  onToggle: (si: number) => void;
  onFeel: (si: number, f: Feel) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onSwap: () => void;
  onDemo: () => void;
}) {
  const ex = getExercise(entry.exerciseId);
  if (!ex) return null;
  const { target } = entry;
  const unit = unitLabel(ex.unit);
  const wLabel = weightLabel(ex);
  const plateWeight = (entry.sets.find((x) => !x.done) ?? entry.sets.at(-1))?.weight ?? null;
  const lastDone = entry.sets.reduce((acc, x, i) => (x.done ? i : acc), -1);
  const askAt = ex.unit === "reps" && lastDone >= 0 && !entry.sets[lastDone].feel ? lastDone : -1;
  const restText = target.restSec >= 60 ? `${Math.floor(target.restSec / 60)}:${String(target.restSec % 60).padStart(2, "0")}` : `${target.restSec}s`;
  const warm = ex.load === "barbell" && !entry.sets.some((x) => x.done) && entry.sets[0]?.weight != null ? warmupSets(entry.sets[0].weight) : [];

  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }, superset ? { borderLeftWidth: 4, borderLeftColor: c.accent } : null]}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        {superset && <Text style={{ color: c.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.6, marginBottom: 4 }}>{superset.toUpperCase()}</Text>}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Pressable onPress={onDemo} style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 19, fontWeight: "700" }}>{ex.name}</Text>
            <Text style={[s.small, { color: c.muted, marginTop: 2 }]}>
              {target.sets} × {target.repMin}–{target.repMax} {unit}
              {target.restSec > 0 ? ` · rest ${restText}` : ""}
            </Text>
          </Pressable>
          <Pressable onPress={onDemo} style={[s.pill, { borderColor: c.line }]} hitSlop={8} accessibilityLabel={`How to do ${ex.name}`}>
            <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>▶ How to</Text>
          </Pressable>
        </View>
        {!!entry.hint && <Text style={{ color: c.accent, fontSize: 15, marginTop: 8 }}>{entry.hint}</Text>}
        <Pressable onPress={onNote} hitSlop={6} style={{ marginTop: 6, alignSelf: "flex-start" }}>
          <Text style={{ color: c.muted, fontSize: entry.note ? 15 : 13 }}>{entry.note ? `📝 ${entry.note}` : "+ Add note"}</Text>
        </Pressable>
        {warm.length > 0 && (
          <Text style={[s.small, { color: c.muted, marginTop: 4 }]}>
            Warm up first: {warm.map((x) => `${x.kg === 20 ? "bar" : `${x.kg} kg`} × ${x.reps}`).join(", ")}
          </Text>
        )}
      </View>

      <View style={[s.row, { paddingHorizontal: 16, paddingBottom: 4 }]}>
        <Text style={[s.colSet, s.head, { color: c.muted }]}>SET</Text>
        <Text style={[s.colPrev, s.head, { color: c.muted }]}>PREVIOUS</Text>
        <Text style={[s.colField, s.head, { color: c.muted }]}>{wLabel.toUpperCase() || " "}</Text>
        <Text style={[s.colField, s.head, { color: c.muted }]}>{unit.toUpperCase()}</Text>
        <View style={s.colTick} />
      </View>

      <View style={{ paddingHorizontal: 10, paddingBottom: 10, gap: 6 }}>
        {entry.sets.map((set, si) => {
          const isNext = si === nextSi;
          const pr = isLivePr(entry, si, past);
          const prev = last?.[si];
          const prevText = prev && prev.done && prev.reps != null ? (prev.weight != null ? `${prev.weight} × ${prev.reps}` : `${prev.reps}`) : "–";
          const field = [s.field, { backgroundColor: set.done ? "transparent" : c.card2 }];
          return (
            <View key={si} style={{ gap: 6 }}>
              <View style={[s.row, s.setRow, set.done ? { backgroundColor: c.accentSoft } : isNext ? { borderColor: c.accent, borderWidth: 2 } : { borderColor: "transparent", borderWidth: 2 }]}>
                {pr ? (
                  <View style={[s.colSet, { backgroundColor: c.accent, borderRadius: 6, paddingVertical: 2 }]}>
                    <Text style={{ color: c.accentInk, fontSize: 11, fontWeight: "800", textAlign: "center" }}>PR</Text>
                  </View>
                ) : (
                  <Text style={[s.colSet, { color: c.text, fontSize: 17, fontWeight: "700", textAlign: "center" }]}>{si + 1}</Text>
                )}
                <Text style={[s.colPrev, { color: c.muted, fontSize: 14, fontVariant: ["tabular-nums"] }]} numberOfLines={1}>
                  {prevText}
                </Text>
                {wLabel ? (
                  <Pressable accessibilityLabel={`Set ${si + 1} weight`} onPress={() => onEdit(si, "weight")} style={[s.colField, field]}>
                    <Text style={[s.fieldText, { color: set.weight == null ? c.muted : c.text }]}>{set.weight ?? "kg"}</Text>
                  </Pressable>
                ) : (
                  <Text style={[s.colField, { color: c.muted, textAlign: "center" }]}>—</Text>
                )}
                <Pressable accessibilityLabel={`Set ${si + 1} ${unit}`} onPress={() => onEdit(si, "reps")} style={[s.colField, field]}>
                  <Text style={[s.fieldText, { color: set.reps == null ? c.muted : c.text }]}>{set.reps ?? (entry.goalReps ? String(entry.goalReps) : `${target.repMin}–${target.repMax}`)}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={set.done ? `Undo set ${si + 1}` : `Complete set ${si + 1}`}
                  onPress={() => onToggle(si)}
                  style={[s.colTick, s.tick, set.done ? { backgroundColor: c.accent } : { borderWidth: 2, borderColor: isNext ? c.accent : c.line }]}
                >
                  <Text style={{ fontSize: 24, fontWeight: "800", color: set.done ? c.accentInk : isNext ? c.accent : c.muted }}>✓</Text>
                </Pressable>
              </View>
              {si === askAt && (
                <View style={[s.row, { paddingLeft: 36, gap: 8 }]}>
                  <Text style={[s.small, { color: c.muted }]}>Reps left?</Text>
                  {FEELS.map((f) => (
                    <Pressable key={f.value} onPress={() => onFeel(si, f.value)} style={({ pressed }) => [s.feel, { borderColor: c.line, backgroundColor: pressed ? c.accent : c.card }]}>
                      {({ pressed }) => (
                        <View style={{ alignItems: "center" }}>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: pressed ? c.accentInk : c.text }}>{f.label}</Text>
                          <Text style={{ fontSize: 11, color: pressed ? c.accentInk : c.muted }}>{f.reps}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {ex.load === "barbell" && plateWeight != null && (
          <Text style={[s.small, { color: c.muted, paddingHorizontal: 6, paddingTop: 2 }]}>
            {plateWeight} kg · {describePlates(plateWeight)}
          </Text>
        )}
      </View>

      <View style={[s.row, { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.line }]}>
        <Pressable onPress={onAddSet} style={s.footBtn}>
          <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>+ Set</Text>
        </Pressable>
        <Pressable onPress={onRemoveSet} disabled={entry.sets.length <= 1} style={[s.footBtn, { opacity: entry.sets.length <= 1 ? 0.4 : 1 }]}>
          <Text style={{ color: c.muted, fontSize: 16 }}>− Set</Text>
        </Pressable>
        <Pressable onPress={onSuperset} style={s.footBtn}>
          <Text style={{ color: superset ? c.accent : c.muted, fontSize: 16 }}>{superset ? "Unpair" : "Superset"}</Text>
        </Pressable>
        <Pressable onPress={onSwap} style={s.footBtn}>
          <Text style={{ color: c.muted, fontSize: 16 }}>Swap</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RestOverlay({ c, rest, workout, onAdd, onFeel, onDone }: { c: Theme; rest: Rest; workout: Workout; onAdd: (sec: number) => void; onFeel: (f: Feel) => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const [small, setSmall] = useState(false);
  const gutter = useGutter();
  const buzzed = useRef(false);
  useEffect(() => {
    buzzed.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.endsAt]);
  const left = Math.max(0, Math.ceil((rest.endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0 && !buzzed.current) {
      buzzed.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 350);
    }
  }, [left]);

  const pct = Math.min(1, Math.max(0, 1 - left / rest.total));
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  const entry = workout.entries[rest.ei];
  const set = entry?.sets[rest.si];
  const ex = entry ? getExercise(entry.exerciseId) : undefined;
  const askFeel = !!set?.done && !set.feel && ex?.unit === "reps";
  const next = nextSet(workout);

  if (small)
    return (
      <Pressable onPress={() => setSmall(false)} style={[s.mini, { backgroundColor: c.card, borderColor: c.line, left: gutter - 4, right: gutter - 4 }]}>
        <View style={[s.bar, { backgroundColor: c.card2 }]}>
          <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: c.accent }} />
        </View>
        <View style={[s.row, { padding: 14, gap: 12 }]}>
          <Text style={{ flex: 1, color: left === 0 ? c.accent : c.text, fontSize: 28, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{left === 0 ? "Rest done" : time}</Text>
          <Pressable onPress={() => onAdd(15)} style={[s.pill, { borderColor: c.line, paddingVertical: 10 }]}>
            <Text style={{ color: c.text, fontSize: 15 }}>+15s</Text>
          </Pressable>
          <Pressable onPress={onDone} style={[s.pill, { backgroundColor: c.accent, borderColor: c.accent, paddingVertical: 10 }]}>
            <Text style={{ color: c.accentInk, fontSize: 15, fontWeight: "700" }}>{left === 0 ? "Close" : "Skip"}</Text>
          </Pressable>
        </View>
      </Pressable>
    );

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDone}>
      <SafeAreaView style={[s.fill, { backgroundColor: c.hero }]}>
        <View style={{ flex: 1, padding: 24, justifyContent: "space-between", width: "100%", maxWidth: 640, alignSelf: "center" }}>
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, fontWeight: "600" }}>{left === 0 ? "Rest done" : "Rest"}</Text>
            <Pressable onPress={() => setSmall(true)} hitSlop={12}>
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 16 }}>Show sets</Text>
            </Pressable>
          </View>

          <View style={{ alignItems: "center", gap: 20 }}>
            <Text style={{ color: "#fff", fontSize: 96, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{time}</Text>
            <View style={[s.bar, { width: "100%", height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.18)" }]}>
              <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: "#fff", borderRadius: 5 }} />
            </View>
            <View style={[s.row, { gap: 12 }]}>
              <Pressable onPress={() => onAdd(-15)} style={s.heroBtn}>
                <Text style={s.heroBtnText}>−15s</Text>
              </Pressable>
              <Pressable onPress={() => onAdd(15)} style={s.heroBtn}>
                <Text style={s.heroBtnText}>+15s</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: 16 }}>
            {askFeel && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 15 }}>Reps left on {ex?.name ?? "that set"}, set {rest.si + 1}?</Text>
                <View style={[s.row, { gap: 10 }]}>
                  {FEELS.map((f) => (
                    <Pressable key={f.value} onPress={() => onFeel(f.value)} style={({ pressed }) => [s.heroBtn, { flex: 1, backgroundColor: pressed ? "#fff" : "rgba(255,255,255,0.15)" }]}>
                      {({ pressed }) => (
                        <View style={{ alignItems: "center" }}>
                          <Text style={[s.heroBtnText, pressed && { color: c.hero }]}>{f.label}</Text>
                          <Text style={{ fontSize: 12, color: pressed ? c.hero : "rgba(255,255,255,0.7)" }}>{f.reps}</Text>
                        </View>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {!!entry?.hint && set?.feel && <Text style={{ color: "#fff", fontSize: 15 }}>{entry.hint}</Text>}
            {next && (
              <View style={{ borderRadius: 16, backgroundColor: "rgba(255,255,255,0.1)", padding: 16 }}>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" }}>UP NEXT</Text>
                <Text style={{ color: "#fff", fontSize: 19, fontWeight: "700", marginTop: 2 }}>{next.name}</Text>
                <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, marginTop: 2 }}>{next.detail}</Text>
              </View>
            )}
            <Pressable onPress={onDone} style={[s.bigBtn, { backgroundColor: "#fff" }]}>
              <Text style={{ color: c.hero, fontSize: 18, fontWeight: "800" }}>{left === 0 ? "Next set" : "Skip rest"}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function SetSheet({ c, workout, editing, onDone, onClose }: { c: Theme; workout: Workout; editing: Editing; onDone: (v: number) => void; onClose: () => void }) {
  const entry = workout.entries[editing.ei];
  const ex = getExercise(entry.exerciseId)!;
  const isWeight = editing.field === "weight";
  const set = entry.sets[editing.si];
  const initial = isWeight
    ? (set.weight ?? entry.sets.findLast((x) => x.weight != null)?.weight ?? (ex.load === "barbell" ? 20 : 0))
    : (set.reps ?? entry.goalReps ?? entry.target.repMin);
  const step = isWeight ? (ex.load === "barbell" || ex.load === "cable" ? 2.5 : 1) : ex.unit === "seconds" ? 5 : 1;
  const bigStep = isWeight ? (ex.load === "barbell" ? 10 : 5) : undefined;
  const unit = isWeight ? weightLabel(ex) : unitLabel(ex.unit);
  const title = editing.thenComplete ? `What weight did you use? (${ex.name})` : `${ex.name} · set ${editing.si + 1} · ${isWeight ? "weight" : unitLabel(ex.unit)}`;
  // Match a weight already loaded on the adjustable set, to save a re-load.
  const presets =
    isWeight && isAdjustable(entry.exerciseId)
      ? [...new Map(adjustableSetups(workout.entries.filter((_, i) => i !== editing.ei)).filter((x) => x.load === ex.load && x.weight != null).map((x) => [x.weight, x])).values()].map((x) => ({
          label: `Match ${x.weight} kg (${getExercise(x.exerciseId)?.name})`,
          value: x.weight as number,
        }))
      : [];

  const [value, setValue] = useState(initial);
  const [text, setText] = useState(String(initial));
  const set2 = (v: number) => {
    const clean = Math.max(0, Math.round(v * 100) / 100);
    tap();
    setValue(clean);
    setText(String(clean));
  };
  const steps = [...(bigStep ? [-bigStep] : []), -step, step, ...(bigStep ? [bigStep] : [])];

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose}>
        <Pressable style={[s.sheet, { backgroundColor: c.card, borderColor: c.line }]} onPress={() => {}}>
          <View style={[s.grabber, { backgroundColor: c.line }]} />
          <Text style={{ color: c.muted, textAlign: "center", fontSize: 15 }}>{title}</Text>
          <View style={[s.row, { justifyContent: "center", alignItems: "baseline", gap: 8, marginVertical: 12 }]}>
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t);
                const n = parseFloat(t.replace(",", "."));
                if (Number.isFinite(n)) setValue(n);
              }}
              keyboardType={isWeight ? "decimal-pad" : "number-pad"}
              selectTextOnFocus
              style={{ color: c.text, fontSize: 56, fontWeight: "800", minWidth: 140, textAlign: "right", fontVariant: ["tabular-nums"] }}
            />
            <Text style={{ color: c.muted, fontSize: 20 }}>{unit}</Text>
          </View>
          {presets.length > 0 && (
            <View style={[s.row, { flexWrap: "wrap", justifyContent: "center", gap: 8, marginBottom: 10 }]}>
              {presets.map((p) => (
                <Pressable key={p.label} onPress={() => set2(p.value)} style={[s.pill, { borderColor: c.accent }]}>
                  <Text style={{ color: c.accent, fontSize: 14 }}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={[s.row, { gap: 8 }]}>
            {steps.map((d) => (
              <Pressable key={d} onPress={() => set2(value + d)} style={({ pressed }) => [s.step, { borderColor: c.line, backgroundColor: c.card2, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>
                  {d > 0 ? "+" : "−"}
                  {Math.abs(d)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => onDone(value)} style={[s.bigBtn, { backgroundColor: c.accent, marginTop: 12 }]}>
            <Text style={{ color: c.accentInk, fontSize: 18, fontWeight: "700" }}>{editing.thenComplete ? "Save and tick" : "Done"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Widest the workout column gets: on iPad the sets stay one easy-to-read column in the middle. */
const COLUMN = 760;

/** Side padding that keeps content in a centred column on iPad (and follows rotation). */
export function useGutter() {
  const { width } = useWindowDimensions();
  return Math.max(16, Math.round((width - COLUMN) / 2));
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  h1: { fontSize: 26, fontWeight: "800", letterSpacing: -0.4 },
  small: { fontSize: 13 },
  finish: { borderRadius: 14, paddingHorizontal: 22, height: 48, justifyContent: "center" },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center" },
  head: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  setRow: { gap: 8, borderRadius: 16, paddingHorizontal: 6, paddingVertical: 4 },
  colSet: { width: 28, textAlign: "center" },
  colPrev: { width: 64 },
  colField: { flex: 1, textAlign: "center" },
  colTick: { width: 60 },
  field: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  fieldText: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  tick: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  feel: { flex: 1, borderWidth: 1, borderRadius: 12, height: 44, alignItems: "center", justifyContent: "center" },
  footBtn: { flex: 1, height: 52, alignItems: "center", justifyContent: "center" },
  wide: { height: 56, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  mini: { position: "absolute", left: 12, right: 12, bottom: 24, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  bar: { height: 4, overflow: "hidden" },
  heroBtn: { height: 56, minWidth: 96, borderRadius: 16, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" },
  heroBtnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  bigBtn: { height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { width: "100%", maxWidth: 640, alignSelf: "center", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, padding: 20, paddingBottom: 36 },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  step: { flex: 1, height: 60, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
