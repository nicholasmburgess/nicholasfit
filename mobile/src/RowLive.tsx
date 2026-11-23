import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatClock, formatMetres, formatSplit, rowLine } from "@/lib/row";
import type { RowPiece } from "@/lib/types";
import type { HrUpdate } from "./heartRate";
import type { Pm5Update } from "./pm5";
import type { Theme } from "./WorkoutScreen";

/**
 * The live rowing view: the PM5's numbers as big as the screen allows, readable from the seat.
 * Always dark (white numbers on black are easiest to read at a glance and in bright light).
 */

const D = { bg: "#000000", tile: "#121a15", text: "#ffffff", muted: "#8f9b93", accent: "#3cc47f", heart: "#ff6b5b", warn: "#f0b44c" };

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
  saved,
  canFinish,
  onMinimise,
  onFinish,
}: {
  pm5: Pm5Update | null;
  hr: HrUpdate | null;
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
  const mid = Math.round(base * 0.15);
  const small = Math.round(base * 0.12);

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
              <View style={[s.tile, { flex: wide ? 1.2 : 1.4 }]}>
                <Text style={s.label}>{paused ? "PAUSED" : "SPLIT /500M"}</Text>
                <Big value={formatSplit(live?.moving ? live.splitS : null)} size={hero} />
                {!active && <Text style={{ color: D.muted, fontSize: 17, textAlign: "center" }}>{pm5?.status === "connected" ? "Start rowing. Numbers appear with your first stroke." : "Wake the PM5 and close ErgData."}</Text>}
                {active && live?.avgSplitS != null && <Text style={{ color: D.muted, fontSize: 18, textAlign: "center", fontVariant: ["tabular-nums"] }}>avg {formatSplit(live.avgSplitS)}</Text>}
              </View>
              <View style={{ flex: wide ? 1 : 2, gap: 12 }}>
                <View style={[s.row, { flex: 1, gap: 12 }]}>
                  <Tile label="TIME" value={formatClock(live?.elapsedS ?? 0)} size={mid} />
                  <Tile label="METRES" value={Math.round(live?.distanceM ?? 0).toLocaleString("en-AU")} size={mid} />
                </View>
                <View style={[s.row, { flex: 1, gap: 12 }]}>
                  <Tile label="SPM" value={live?.moving && live.spm ? String(live.spm) : "–"} size={small} />
                  <Tile label="WATTS" value={live?.moving && live.watts ? String(live.watts) : "–"} size={small} />
                  <Tile label="♥ BPM" value={bpm != null ? String(bpm) : "–"} size={small} color={bpm != null ? D.heart : undefined} />
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
});
