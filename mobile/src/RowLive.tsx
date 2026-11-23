import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { easyRange, formatClock, formatMetres, formatSplit, rowLine, zoneOf } from "@/lib/row";
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
  canFinish,
  onMinimise,
  onFinish,
}: {
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
              <Text style={{ color: D.muted, fontSize: 15, textAlign: "center" }}>Start rowing again to log another piece.</Text>
            </View>
          ) : (
            <View style={[s.fill, { gap: 12 }, wide && { flexDirection: "row" }]}>
              <View style={[s.tile, { flex: wide ? 1.2 : 1.3 }]}>
                <Text style={s.label}>{paused ? "PAUSED" : "SPLIT /500M"}</Text>
                <Big value={formatSplit(live?.moving ? live.splitS : null)} size={hero} />
                {!active && <Text style={{ color: D.muted, fontSize: 17, textAlign: "center" }}>{pm5?.status === "connected" ? "Start rowing. Numbers appear with your first stroke." : "Wake the PM5 and close ErgData."}</Text>}
                {active && live?.avgSplitS != null && <Text style={{ color: D.muted, fontSize: 18, textAlign: "center", fontVariant: ["tabular-nums"] }}>avg {formatSplit(live.avgSplitS)}</Text>}
              </View>
              <View style={{ flex: wide ? 1 : 2, gap: 12 }}>
                <PaceGuide bpm={bpm} maxHr={maxHr} rowing={active} />
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

/**
 * Heart rate with what to do about it: hold this pace in zone 2, ease off above it (amber after
 * 20 s, with one buzz; red in zone 4+), or a nudge to push a little below it.
 */
function PaceGuide({ bpm, maxHr, rowing }: { bpm: number | null; maxHr: number | null; rowing: boolean }) {
  const above = bpm != null && maxHr != null && zoneOf(bpm, maxHr) >= 3;
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

  if (bpm == null || maxHr == null) {
    return (
      <View style={[s.guide, { backgroundColor: GUIDE.none.bg }]}>
        <Text style={{ color: D.text, fontSize: 30, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
          <Text style={{ color: bpm != null ? D.heart : D.muted }}>♥ </Text>
          {bpm ?? "–"}
        </Text>
        <Text style={{ color: D.muted, fontSize: 14 }}>
          {bpm == null ? "No heart rate. Put the strap on (wet the contacts)." : "Add your birth year in the app's profile to see your easy zone."}
        </Text>
      </View>
    );
  }
  const zone = zoneOf(bpm, maxHr);
  const [lo, hi] = easyRange(maxHr);
  const state = zone >= 4 && warn ? "tooHigh" : zone >= 3 && warn ? "high" : zone <= 1 && rowing ? "low" : "ok";
  const g = GUIDE[state];
  const msg =
    state === "tooHigh"
      ? "Well above easy · slow right down"
      : state === "high"
        ? "Too hard for an easy row · ease off"
        : state === "low"
          ? "Below your easy zone · push a little"
          : zone >= 3
            ? "Drifting high · ease off a touch"
            : "In your easy zone · hold this pace";
  // Marker position on the zone bar: 50% of max at the left, 100% at the right.
  const pos = Math.min(1, Math.max(0, (bpm / maxHr - 0.5) / 0.5));
  return (
    <View style={[s.guide, { backgroundColor: g.bg }]} accessibilityLabel={`Heart rate ${bpm}, zone ${zone}. ${msg}`}>
      <View style={[s.row, { alignItems: "baseline" }]}>
        <Text style={{ color: g.ink, fontSize: 40, fontWeight: "800", fontVariant: ["tabular-nums"] }}>♥ {bpm}</Text>
        <Text style={{ color: g.ink, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 }}>ZONE {zone}</Text>
      </View>
      <Text style={{ color: D.text, fontSize: 18, fontWeight: "700" }}>{msg}</Text>
      <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
        {ZONE_COLOURS.map((c) => (
          <View key={c} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: c, opacity: 0.35 }} />
        ))}
        <View style={{ position: "absolute", top: -4, left: `${pos * 100}%`, width: 4, height: 16, borderRadius: 2, backgroundColor: "#fff", marginLeft: -2 }} />
      </View>
      <Text style={{ color: D.muted, fontSize: 13 }}>
        Easy zone {lo}–{hi} bpm
      </Text>
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
});
