import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ZONE_PCT, formatClock, formatMetres, formatSplit, rowLine, zoneOf } from "@/lib/row";
import { type RowSession, workReps } from "@/lib/row-sessions";
import type { IntervalState } from "./intervals";
import type { RowPiece } from "@/lib/types";
import type { HrUpdate } from "./heartRate";
import type { Pm5Update } from "./pm5";
import type { Theme } from "./WorkoutScreen";

/**
 * The live rowing view: the PM5's numbers as big as the screen allows, readable from the seat.
 * Always dark (white numbers on black are easiest to read at a glance and in bright light).
 */

const D = { bg: "#000000", tile: "#121a15", text: "#ffffff", muted: "#8f9b93", accent: "#3cc47f", heart: "#ff6b5b", warn: "#f0b44c" };

/** Zone colours, 1–5, and the strip's background for each guide state. */
const ZONE_COLOURS = ["#7aa7ff", "#3cc47f", "#f0b44c", "#ff8a4c", "#ff6b5b"];
const GUIDE = {
  low: { ink: "#7aa7ff", bg: "#101c33" },
  ok: { ink: "#3cc47f", bg: "#0f3d2a" },
  high: { ink: "#f0b44c", bg: "#3a2a0c" },
  tooHigh: { ink: "#ff6b5b", bg: "#3d1210" },
  none: { ink: "#8f9b93", bg: "#121a15" },
};
/** Seconds above the easy zone before the strip turns amber and buzzes, so one hard stroke doesn't. */
const WARN_AFTER_S = 20;

function statusText(pm5: Pm5Update | null): { text: string; tone: "ok" | "wait" | "bad" } {
  if (!pm5 || pm5.status === "off") return { text: "Rower not connected", tone: "bad" };
  if (pm5.status === "connected") return { text: `${pm5.device ?? "PM5"} connected`, tone: "ok" };
  if (pm5.status === "searching") return { text: pm5.message ?? "Looking for your rower…", tone: "wait" };
  return { text: pm5.message ?? "Bluetooth problem", tone: "bad" };
}

/** Heart rate from the Polar strap, or from a strap paired to the PM5 if the phone has none. */
export function liveHeart(hr: HrUpdate | null, pm5: Pm5Update | null): number | null {
  return hr?.bpm ?? pm5?.live?.heartRate ?? null;
}

export function RowOverlay({
  pm5,
  hr,
  maxHr,
  saved,
  guided,
  canFinish,
  onMinimise,
  onFinish,
}: {
  /** A guided row (tempo or intervals): where it's up to and the target split for hard parts. */
  guided: { session: RowSession; state: IntervalState | null; targetSplitS: number | null } | null;
  pm5: Pm5Update | null;
  hr: HrUpdate | null;
  /** Estimated max heart rate; null when the birth year isn't known yet. */
  maxHr: number | null;
  /** The piece just logged, shown until the next one starts. */
  saved: RowPiece | null;
  canFinish: boolean;
  onMinimise: () => void;
  onFinish: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width > height;
  const live = pm5?.live ?? null;
  const st = statusText(pm5);
  const bpm = liveHeart(hr, pm5);
  const active = !!live?.active;
  const paused = active && !live?.moving;
  const showSaved = !!saved && !active;
  // Scale with the screen so the split is as big as it can be on iPhone and iPad.
  const base = Math.min(width, wide ? height * 1.3 : height * 0.62);
  const hero = Math.round(base * 0.3);
  const mid = Math.round(base * 0.14);
  const small = Math.round(base * 0.11);
  const st8 = guided?.state ?? null;
  const kind = st8?.seg.kind;
  // What the heart-rate guide aims for right now.
  const mode: GuideMode = !guided ? "easy" : kind === "work" ? "work" : kind === "easy" ? "recover" : "easy";
  const zone: [number, number] = mode === "work" && guided ? guided.session.workZone : [2, 2];
  const target = mode === "work" ? (guided?.targetSplitS ?? null) : null;
  const split = live?.moving ? live.splitS : null;

  return (
    <Modal animationType="fade" visible onRequestClose={onMinimise} supportedOrientations={["portrait", "landscape"]}>
      <SafeAreaView style={[s.fill, { backgroundColor: D.bg }]}>
        <View style={[s.fill, { padding: 16, gap: 12 }]}>
          <View style={s.row}>
            <View style={[s.dot, { backgroundColor: st.tone === "ok" ? D.accent : st.tone === "wait" ? D.warn : D.heart }]} />
            <Text style={{ flex: 1, color: D.muted, fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
              {st.text}
            </Text>
            <Pressable onPress={onMinimise} hitSlop={12} style={s.pill}>
              <Text style={{ color: D.text, fontSize: 16, fontWeight: "600" }}>Show sets</Text>
            </Pressable>
          </View>

          {showSaved ? (
            <View style={[s.fill, { justifyContent: "center", gap: 16 }]}>
              <Text style={{ color: D.accent, fontSize: 22, fontWeight: "800", textAlign: "center" }}>✓ Row saved</Text>
              <Big value={formatMetres(saved.distanceM)} size={mid} />
              <Text style={{ color: D.text, fontSize: 20, textAlign: "center", lineHeight: 28 }}>{rowLine(saved)}</Text>
              {!!saved.reps?.length && <RepTable reps={saved.reps} target={saved.targetSplitS ?? null} />}
              {!saved.session && <Text style={{ color: D.muted, fontSize: 15, textAlign: "center" }}>Start rowing again to log another piece.</Text>}
            </View>
          ) : (
            <View style={[s.fill, { gap: 12 }, wide && { flexDirection: "row" }]}>
              <View style={{ flex: wide ? 1.2 : 1.3, gap: 12 }}>
              {guided && <IntervalBanner session={guided.session} state={st8} />}
              <View style={[s.tile, { flex: 1 }]}>
                <Text style={s.label}>{paused ? "PAUSED" : "SPLIT /500M"}</Text>
                <Big value={formatSplit(split)} size={guided ? Math.round(hero * 0.85) : hero} />
                {target != null && <TargetLine split={split} target={target} />}
                {guided && st8?.seg.kind === "warmup" && <Text style={{ color: D.muted, fontSize: 17, textAlign: "center" }}>Warm up easy · {guided.targetSplitS ? `hard reps aim for ${formatSplit(guided.targetSplitS, false)}` : "first rep sets your target"}</Text>}
                {!active && <Text style={{ color: D.muted, fontSize: 17, textAlign: "center" }}>{pm5?.status === "connected" ? "Start rowing. Numbers appear with your first stroke." : "Wake the PM5 and close ErgData."}</Text>}
                {active && !guided && live?.avgSplitS != null && <Text style={{ color: D.muted, fontSize: 18, textAlign: "center", fontVariant: ["tabular-nums"] }}>avg {formatSplit(live.avgSplitS)}</Text>}
              </View>
              </View>
              <View style={{ flex: wide ? 1 : 2, gap: 12 }}>
                <PaceGuide key={`${mode}-${st8?.index ?? 0}`} bpm={bpm} maxHr={maxHr} rowing={active} mode={mode} zone={zone} />
                <View style={[s.row, { flex: 0.9, gap: 12 }]}>
                  <Tile label="TIME" value={formatClock(live?.elapsedS ?? 0)} size={mid} />
                  <Tile label="METRES" value={Math.round(live?.distanceM ?? 0).toLocaleString("en-AU")} size={mid} />
                </View>
                <View style={[s.row, { flex: 0.7, gap: 12 }]}>
                  <Tile label="SPM" value={live?.moving && live.spm ? String(live.spm) : "–"} size={small} />
                  <Tile label="WATTS" value={live?.moving && live.watts ? String(live.watts) : "–"} size={small} />
                </View>
              </View>
            </View>
          )}

          {canFinish && !active ? (
            <Pressable onPress={onFinish} style={[s.btn, { backgroundColor: D.accent }]}>
              <Text style={{ color: "#06140c", fontSize: 19, fontWeight: "800" }}>Finish workout</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type GuideMode = "easy" | "work" | "recover";

/** bpm range of zones lo..hi. */
function zoneRange(max: number, [lo, hi]: [number, number]): [number, number] {
  return [Math.round(max * ZONE_PCT[lo - 1]), Math.round(max * ZONE_PCT[hi])];
}

/**
 * Heart rate with what to do about it.
 * - easy (easy row, warm-up, cool-down): hold zone 2; ease off above it (amber after 20 s with one
 *   buzz, red in zone 4+); a nudge to push a little below it.
 * - work (hard rep): aim for the session's zone. Heart rate lags a minute or so behind effort, so
 *   below the zone just says to hold the target split; above it warns after 20 s.
 * - recover (easy part between reps): no warnings, it's meant to be coming down.
 */
function PaceGuide({ bpm, maxHr, rowing, mode, zone: aim }: { bpm: number | null; maxHr: number | null; rowing: boolean; mode: GuideMode; zone: [number, number] }) {
  const z = bpm != null && maxHr != null ? zoneOf(bpm, maxHr) : null;
  const above = z != null && mode !== "recover" && z > aim[1];
  const since = useRef<number | null>(null);
  const [warn, setWarn] = useState(false);
  useEffect(() => {
    if (!above || !rowing) {
      since.current = null;
      setWarn(false);
      return;
    }
    since.current ??= Date.now();
    const t = setTimeout(() => setWarn(true), Math.max(0, WARN_AFTER_S * 1000 - (Date.now() - since.current)));
    return () => clearTimeout(t);
  }, [above, rowing]);
  useEffect(() => {
    if (warn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [warn]);

  if (bpm == null || maxHr == null || z == null) {
    return (
      <View style={[s.guide, { backgroundColor: GUIDE.none.bg }]}>
        <Text style={{ color: D.text, fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
          <Text style={{ color: bpm != null ? D.heart : D.muted }}>♥ </Text>
          {bpm ?? "–"}
        </Text>
        <Text style={{ color: D.muted, fontSize: 14 }}>
          {bpm == null ? "No heart rate. Put the strap on (wet the contacts)." : "Add your birth year in the app's profile to see your zones."}
        </Text>
      </View>
    );
  }
  const [lo, hi] = zoneRange(maxHr, aim);
  let state: keyof typeof GUIDE;
  let msg: string;
  if (mode === "recover") {
    state = z <= 2 ? "ok" : "high";
    msg = z <= 2 ? "Recovered · ready for the next rep" : "Recovering · let your heart rate drop";
  } else if (above) {
    state = warn ? ((z >= 4 && aim[1] < 4) || (z === 5 && aim[1] < 5) ? "tooHigh" : "high") : "ok";
    msg = mode === "work" ? (warn ? "Above target · ease off a little" : "Drifting high · ease off a touch") : warn ? (z >= 4 ? "Well above easy · slow right down" : "Too hard for an easy row · ease off") : "Drifting high · ease off a touch";
  } else if (z < aim[0]) {
    state = mode === "work" ? "ok" : rowing ? "low" : "ok";
    msg = mode === "work" ? "Heart rate catching up · hold your target split" : "Below your easy zone · push a little";
  } else {
    state = "ok";
    msg = mode === "work" ? "Right where you should be · keep it" : "In your easy zone · hold this pace";
  }
  const g = mode === "work" && state === "ok" ? { ink: "#ff8a4c", bg: "#3b1e10" } : GUIDE[state];
  const pos = Math.min(1, Math.max(0, (bpm / maxHr - 0.5) / 0.5));
  const label = aim[0] === aim[1] ? `zone ${aim[0]}` : `zones ${aim[0]}–${aim[1]}`;
  return (
    <View style={[s.guide, { backgroundColor: g.bg }]} accessibilityLabel={`Heart rate ${bpm}, zone ${z}. ${msg}`}>
      <View style={[s.row, { alignItems: "baseline" }]}>
        <Text style={{ color: g.ink, fontSize: 40, fontWeight: "800", fontVariant: ["tabular-nums"] }}>♥ {bpm}</Text>
        <Text style={{ color: g.ink, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 }}>ZONE {z}</Text>
      </View>
      <Text style={{ color: D.text, fontSize: 18, fontWeight: "700" }}>{msg}</Text>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
        {ZONE_COLOURS.map((c) => (
          <View key={c} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c, opacity: 0.35 }} />
        ))}
        <View style={{ position: "absolute", top: -4, left: `${pos * 100}%`, width: 4, height: 16, borderRadius: 2, backgroundColor: "#fff", marginLeft: -2 }} />
      </View>
      <Text style={{ color: D.muted, fontSize: 13 }}>
        {mode === "recover" ? `Easy zone ${zoneRange(maxHr, [2, 2]).join("–")} bpm` : `Target ${label} · ${lo}–${hi} bpm`}
      </Text>
    </View>
  );
}

const PHASE: Record<string, { label: string; ink: string; bg: string }> = {
  warmup: { label: "WARM-UP", ink: "#3cc47f", bg: "#0f2a1e" },
  work: { label: "HARD", ink: "#ff8a4c", bg: "#3b1e10" },
  easy: { label: "EASY", ink: "#7aa7ff", bg: "#101c33" },
  cooldown: { label: "COOL-DOWN", ink: "#3cc47f", bg: "#0f2a1e" },
};

/** Which part of the session, a countdown, what's next, and the reps done so far. */
function IntervalBanner({ session, state }: { session: RowSession; state: IntervalState | null }) {
  const n = workReps(session);
  if (!state) {
    return (
      <View style={[s.banner, { backgroundColor: D.tile }]}>
        <Text style={{ color: D.text, fontSize: 18, fontWeight: "800" }}>{session.name}</Text>
        <Text style={{ color: D.muted, fontSize: 14, marginTop: 2 }}>{session.short}. Set the PM5 to Just Row and start; the phone times each part. Keep rowing gently in the easy parts.</Text>
      </View>
    );
  }
  if (state.done) {
    return (
      <View style={[s.banner, { backgroundColor: "#0f3d2a" }]}>
        <Text style={{ color: D.accent, fontSize: 18, fontWeight: "800" }}>✓ Session done</Text>
      </View>
    );
  }
  const p = PHASE[state.seg.kind];
  const nextText = !state.next
    ? "Last part · then you're done"
    : state.next.kind === "work"
      ? `Next: rep ${state.rep + 1} · ${formatClock(state.next.seconds)} hard`
      : state.next.kind === "easy"
        ? `Next: ${formatClock(state.next.seconds)} easy`
        : "Next: cool-down";
  const repsDone = state.seg.kind === "work" ? state.rep - 1 : state.rep;
  return (
    <View style={[s.banner, { backgroundColor: p.bg }]}>
      <View style={[s.row, { alignItems: "baseline" }]}>
        <Text style={{ color: p.ink, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 }}>{p.label}</Text>
        {state.seg.kind === "work" || state.seg.kind === "easy" ? <Text style={{ color: D.muted, fontSize: 14 }}>rep {state.rep} of {n}</Text> : null}
        <Text style={{ marginLeft: "auto", color: D.text, fontSize: 44, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{formatClock(state.left)}</Text>
      </View>
      <Text style={{ color: "#cfd8d2", fontSize: 15, marginBottom: 8 }}>{nextText}</Text>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < repsDone ? "#ffffff" : i === state.rep - 1 && state.seg.kind === "work" ? p.ink : "#24302a" }} />
        ))}
      </View>
    </View>
  );
}

/** "target 2:05 · on pace ✓", or how far off it is. */
function TargetLine({ split, target }: { split: number | null; target: number }) {
  const diff = split == null ? null : split - target;
  const [text, colour] =
    diff == null ? [`target ${formatSplit(target, false)}`, D.muted] : diff > 1.5 ? [`target ${formatSplit(target, false)} · ${diff.toFixed(1)} s slow`, D.warn] : diff < -5 ? [`target ${formatSplit(target, false)} · a bit fast, save some`, D.warn] : [`target ${formatSplit(target, false)} · on pace ✓`, "#ff8a4c"];
  return <Text style={{ color: colour, fontSize: 18, fontWeight: "700", textAlign: "center", fontVariant: ["tabular-nums"] }}>{text}</Text>;
}

/** Each hard rep after a guided row. */
function RepTable({ reps, target }: { reps: NonNullable<RowPiece["reps"]>; target: number | null }) {
  const best = Math.min(...reps.map((r) => r.splitS ?? Infinity));
  const shown = reps.length > 8 ? [...reps.slice(0, 4), ...reps.slice(-3)] : reps;
  return (
    <View style={[s.tile, { alignItems: "stretch", paddingHorizontal: 14 }]}>
      <View style={s.tr}>
        {["REP", "SPLIT", "SPM", "W", "♥ MAX"].map((h) => (
          <Text key={h} style={[s.td, s.label, { textAlign: h === "REP" ? "left" : "right" }]}>{h}</Text>
        ))}
      </View>
      {shown.map((r) => (
        <View key={r.rep} style={s.tr}>
          <Text style={[s.td, { textAlign: "left" }]}>{r.rep}</Text>
          <Text style={[s.td, r.splitS === best && { color: D.accent, fontWeight: "800" }, target != null && r.splitS != null && r.splitS > target + 1.5 && { color: D.warn }]}>{formatSplit(r.splitS)}</Text>
          <Text style={s.td}>{r.avgSpm ?? "–"}</Text>
          <Text style={s.td}>{r.avgWatts ?? "–"}</Text>
          <Text style={s.td}>{r.maxHr ?? "–"}</Text>
        </View>
      ))}
    </View>
  );
}

function Big({ value, size, color = D.text }: { value: string; size: number; color?: string }) {
  return (
    <Text style={{ color, fontSize: size, fontWeight: "800", textAlign: "center", fontVariant: ["tabular-nums"], letterSpacing: -1 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.4}>
      {value}
    </Text>
  );
}

function Tile({ label, value, size, color }: { label: string; value: string; size: number; color?: string }) {
  return (
    <View style={[s.tile, { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      <Big value={value} size={size} color={color} />
    </View>
  );
}

/** A short status line inside the rowing exercise card, with a button to open the live view. */
export function RowStatus({ c, pm5, onOpen }: { c: Theme; pm5: Pm5Update | null; onOpen: () => void }) {
  if (!pm5 || pm5.status === "off") return null;
  const live = pm5.live;
  const st = statusText(pm5);
  const help =
    pm5.status === "searching"
      ? "Wake the PM5 and close ErgData. Still not found after 20 seconds? Press Connect on the PM5's main menu."
      : pm5.status === "connected" && !live?.active
        ? "Start rowing and the live view opens by itself."
        : null;
  return (
    <View style={[s.status, { backgroundColor: c.card2 }]}>
      <View style={[s.row, { gap: 8 }]}>
        <View style={[s.dot, { backgroundColor: st.tone === "ok" ? c.accent : st.tone === "wait" ? c.warn : c.danger }]} />
        <Text style={{ flex: 1, color: c.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
          {live?.active ? `${formatSplit(live.moving ? live.splitS : null, false)} /500m · ${formatMetres(live.distanceM)} · ${formatClock(live.elapsedS)}` : st.text}
        </Text>
        {pm5.status === "connected" && (
          <Pressable onPress={onOpen} hitSlop={8} style={[s.pill, { borderColor: c.accent }]}>
            <Text style={{ color: c.accent, fontSize: 14, fontWeight: "700" }}>Live view</Text>
          </Pressable>
        )}
      </View>
      {help && <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>{help}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tile: { backgroundColor: D.tile, borderRadius: 20, padding: 12, justifyContent: "center" },
  label: { color: D.muted, fontSize: 14, fontWeight: "700", letterSpacing: 1, textAlign: "center" },
  btn: { height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  status: { borderRadius: 14, padding: 12, marginTop: 10 },
  guide: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  banner: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  tr: { flexDirection: "row", paddingVertical: 4 },
  td: { flex: 1, color: D.text, fontSize: 15, textAlign: "right", fontVariant: ["tabular-nums"] },
});
