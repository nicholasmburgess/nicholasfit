import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, Linking, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { authorize, healthAvailable, readHealth, saveRowingWorkout, saveStrengthWorkout } from "./src/health";
import { HeartRateSession, type HrUpdate, thin } from "./src/heartRate";
import { type Session, activeWorkout, deleteRemote, getSnapshot, release, saveSession, saveSnapshot, saveWorkout, type Snapshot } from "./src/store";
import { WorkoutScreen } from "./src/WorkoutScreen";
import { endAllRests } from "./src/restActivity";
import { refreshWidget } from "./src/widgetData";
import { buildWorkout } from "@/lib/new-workout";
import { DEFAULT_PLAN, planRoutines } from "@/lib/plan";
import { nextRoutineKey } from "@/lib/progression";
import { getExercise } from "@/lib/exercises";
import { workoutRows } from "@/lib/row";
import { zonesMax } from "@/lib/row-sessions";
import type { RowPiece, Workout } from "@/lib/types";

/** The web app this shell shows. Everything except Health and Bluetooth lives there. */
const APP_URL = "https://nicholasfit.vercel.app";
const APP_HOST = new URL(APP_URL).host;
/** Hosts that sign-in flows (Withings) open inside the app rather than in Safari. */
const IN_APP_HOSTS = [APP_HOST, "account.withings.com"];
/** 2: the native workout screen (startWorkout/openWorkout/workoutClosed, session and snapshot). */
const BRIDGE_VERSION = 2;

type FromWeb =
  | { type: "hello" }
  | { type: "healthSync"; days?: number }
  | { type: "hrStart" }
  | { type: "hrStop" }
  | { type: "workoutFinished"; id: string; name: string; startedAt: string; finishedAt: string }
  | { type: "session"; session: Session }
  | { type: "snapshot"; snapshot: Omit<Snapshot, "savedAt"> }
  | { type: "startWorkout"; key: string | null; snapshot?: Omit<Snapshot, "savedAt"> }
  | { type: "openWorkout"; workout: Workout }
  | { type: "shareFile"; name: string; mime: string; text: string };

const COLORS = {
  light: { bg: "#f4f6f5", text: "#0b4d34", muted: "#66706b", accent: "#0b4d34", accentInk: "#ffffff" },
  dark: { bg: "#0a0f0c", text: "#eef2ec", muted: "#8f9b93", accent: "#3cc47f", accentInk: "#06140c" },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

type Open = { workout: Workout; history: Workout[]; maxHr: number | null };

function Shell() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const c = COLORS[scheme];
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const hr = useRef<HeartRateSession | null>(null);
  const [hrState, setHrState] = useState<HrUpdate | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Open | null>(null);
  /** The website has loaded and talked to us, so it can take a workout back. */
  const webReady = useRef(false);

  const send = useCallback((msg: object) => {
    const js = `window.dispatchEvent(new CustomEvent("nicholasfit-native", { detail: ${JSON.stringify(msg)} })); true;`;
    web.current?.injectJavaScript(js);
  }, []);

  const syncHealth = useCallback(
    async (days = 14) => {
      if (!healthAvailable()) return send({ type: "healthData", error: "Apple Health isn't available on this device." });
      try {
        await authorize();
        send({ type: "healthData", ...(await readHealth(days)) });
      } catch (e) {
        send({ type: "healthData", error: e instanceof Error ? e.message : "Couldn't read Apple Health." });
      }
    },
    [send],
  );

  const startHr = useCallback(() => {
    activateKeepAwakeAsync("workout").catch(() => {});
    if (hr.current) return;
    hr.current = new HeartRateSession((u) => {
      setHrState(u);
      send({ type: "hr", ...u });
    });
    hr.current.start();
  }, [send]);

  const stopHr = useCallback(() => {
    hr.current?.stop();
    hr.current = null;
    setHrState(null);
    deactivateKeepAwake("workout");
  }, []);

  /**
   * Save a finished workout (with heart rate) to Apple Health. A session that was only rowing on
   * the PM5 is saved as a rowing workout with its distance and calories; anything else as strength.
   */
  const saveToHealth = useCallback(
    async (w: { id: string; name: string; startedAt: string; finishedAt: string }, rows: RowPiece[] = []) => {
      const samples = thin(hr.current?.samples ?? [], Date.parse(w.startedAt), Date.parse(w.finishedAt));
      stopHr();
      if (!healthAvailable()) return;
      try {
        await authorize();
        const stats = rows.length ? await saveRowingWorkout(w, rows, samples) : await saveStrengthWorkout(w, samples);
        send({ type: "workoutSaved", id: w.id, ...stats });
      } catch (err) {
        send({ type: "workoutSaved", id: w.id, error: err instanceof Error ? err.message : "Couldn't save to Apple Health" });
      }
    },
    [send, stopHr],
  );

  const openWorkout = useCallback(
    async (w: Workout) => {
      const snap = await getSnapshot();
      setOpen({ workout: w, history: (snap?.history ?? []).filter((x) => x.id !== w.id), maxHr: zonesMax(snap?.birthYear ?? null, snap?.plan.rowCoaching) });
      startHr();
    },
    [startHr],
  );

  /** Start a routine on the phone, using the plan and history the website last handed over. Works with no signal. */
  const startWorkout = useCallback(
    async (key: string | null) => {
      const existing = await activeWorkout();
      if (existing) return openWorkout(existing);
      const snap = await getSnapshot();
      const w = buildWorkout(Crypto.randomUUID(), snap?.history ?? [], key, snap?.plan ?? DEFAULT_PLAN);
      await saveWorkout(w);
      openWorkout(w);
    },
    [openWorkout],
  );

  /** Give the workout back to the website, which saves it and shows it. */
  const handBack = useCallback(
    async (w: Workout, discarded = false) => {
      await release(w);
      send({ type: "workoutClosed", workout: w, discarded });
    },
    [send],
  );

  // A workout left open on the phone (app closed mid-session) comes straight back.
  useEffect(() => {
    activeWorkout().then((w) => w && openWorkout(w));
  }, [openWorkout]);

  // The Nutrition rings widget opens nicholasfit://log-food.
  const pendingFood = useRef(false);
  const openFood = useCallback(() => {
    if (!webReady.current) {
      pendingFood.current = true;
      return;
    }
    web.current?.injectJavaScript(`window.location.assign(${JSON.stringify(`${APP_URL}/food?log=1`)}); true;`);
  }, []);
  useEffect(() => {
    const handle = (url?: string | null) => {
      const action = url?.match(/^nicholasfit:\/\/([\w-]+)/)?.[1];
      // nicholasfit://quick is the old rings-widget link: it now opens food logging too.
      if (action === "log-food" || action === "quick") openFood();
    };
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, [openFood]);

  // A rest timer left on the Lock Screen by a closed app is cleared; the widget gets fresh numbers.
  useEffect(() => {
    endAllRests();
    refreshWidget();
  }, []);

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let msg: FromWeb;
      try {
        msg = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "hello":
          webReady.current = true;
          send({ type: "native", version: BRIDGE_VERSION, health: healthAvailable(), bluetooth: true });
          if (pendingFood.current) {
            pendingFood.current = false;
            openFood();
          }
          break;
        case "session":
          await saveSession(msg.session);
          refreshWidget();
          break;
        case "snapshot":
          await saveSnapshot({ ...msg.snapshot, savedAt: new Date().toISOString() });
          refreshWidget();
          break;
        case "startWorkout":
          if (msg.snapshot) await saveSnapshot({ ...msg.snapshot, savedAt: new Date().toISOString() });
          startWorkout(msg.key);
          break;
        case "openWorkout":
          if (msg.workout.finishedAt) break;
          await saveWorkout(msg.workout);
          openWorkout(msg.workout);
          break;
        case "shareFile":
          shareFile(msg.name, msg.mime, msg.text);
          break;
        case "healthSync":
          syncHealth(msg.days);
          break;
        case "hrStart":
          startHr();
          break;
        case "hrStop":
          stopHr();
          break;
        case "workoutFinished":
          saveToHealth(msg);
          break;
      }
    },
    [send, syncHealth, startHr, stopHr, saveToHealth, startWorkout, openWorkout, openFood],
  );

  // Tell the page whenever the app comes back to the front so it can refresh (and re-sync Health).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") send({ type: "resumed" });
      // Leaving the app (often right after logging a meal) or coming back updates the widget.
      if (s === "active" || s === "background") refreshWidget();
    });
    return () => sub.remove();
  }, [send]);

  useEffect(() => stopHr, [stopHr]);

  const workoutScreen = open && (
    <View style={StyleSheet.absoluteFill}>
      <WorkoutScreen
        key={open.workout.id}
        initial={open.workout}
        history={open.history}
        hr={hrState}
        hrSamples={() => hr.current?.samples ?? []}
        maxHr={open.maxHr}
        onFinish={async (w) => {
          setOpen(null);
          // Rowing-only sessions go to Health as rowing; a row inside a strength day stays part of it.
          const lifted = w.entries.some((e) => getExercise(e.exerciseId)?.pattern !== "Cardio" && e.sets.some((x) => x.done));
          saveToHealth({ id: w.id, name: w.name, startedAt: w.startedAt, finishedAt: w.finishedAt! }, lifted ? [] : workoutRows(w));
          refreshWidget();
          // With the website open it takes over (summary, coach); otherwise the phone syncs it later.
          if (webReady.current && !failed) await handBack(w);
          else Alert.alert("Workout saved", "It's on this phone and will sync when you have signal.");
        }}
        onDiscard={async (w) => {
          setOpen(null);
          stopHr();
          if (webReady.current && !failed) await handBack(w, true);
          else {
            await release(w);
            deleteRemote(w.id);
          }
        }}
        onOpenWeb={async (w) => {
          if (!webReady.current || failed)
            return Alert.alert("Needs signal", "Swapping or adding exercises uses the full app, which can't load right now. Your sets are saved.");
          setOpen(null);
          await handBack(w);
        }}
      />
    </View>
  );

  if (failed)
    return (
      <View style={{ flex: 1 }}>
        <OfflineHome c={c} onRetry={() => setFailed(false)} onStart={startWorkout} />
        {workoutScreen}
      </View>
    );

  return (
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <WebView
        ref={web}
        source={{ uri: APP_URL }}
        style={{ flex: 1, backgroundColor: c.bg }}
        injectedJavaScriptBeforeContentLoaded={`window.NicholasfitNative = { version: ${BRIDGE_VERSION} }; true;`}
        onMessage={onMessage}
        sharedCookiesEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grant"
        pullToRefreshEnabled
        contentInsetAdjustmentBehavior="never"
        decelerationRate="normal"
        startInLoadingState
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.bg }]}>
            <ActivityIndicator color={c.text} />
          </View>
        )}
        onError={() => {
          webReady.current = false;
          setFailed(true);
        }}
        onContentProcessDidTerminate={() => web.current?.reload()}
        onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
          let host = "";
          try {
            host = new URL(req.url).host;
          } catch {
            return true;
          }
          if (!req.url.startsWith("http") || IN_APP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) || !req.isTopFrame) return true;
          Linking.openURL(req.url).catch(() => {});
          return false;
        }}
      />
      {workoutScreen}
    </SafeAreaView>
  );
}

/** Write a file (e.g. a CSV export) and open the share sheet: Save to Files, Mail, AirDrop. */
async function shareFile(name: string, mime: string, text: string) {
  try {
    const file = new File(Paths.cache, name.replace(/[^\w.-]/g, "_"));
    if (file.exists) file.delete();
    file.create();
    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: mime === "text/csv" ? "public.comma-separated-values-text" : undefined, dialogTitle: name });
  } catch (e) {
    Alert.alert("Couldn't export", e instanceof Error ? e.message : "Try again.");
  }
}

/** Shown when the website can't load: you can still start or resume a workout on the phone. */
function OfflineHome({ c, onRetry, onStart }: { c: (typeof COLORS)["light"]; onRetry: () => void; onStart: (key: string | null) => void }) {
  const [snap, setSnap] = useState<Snapshot | null | undefined>(undefined);
  const [active, setActive] = useState<Workout | null>(null);
  useEffect(() => {
    getSnapshot().then(setSnap);
    activeWorkout().then(setActive);
  }, []);
  const routines = planRoutines(snap?.plan ?? DEFAULT_PLAN);
  const nextKey = nextRoutineKey(snap?.history ?? []);
  const next = routines.find((r) => r.key === nextKey) ?? routines[0];
  return (
    <View style={[styles.center, { backgroundColor: c.bg }]}>
      <Text style={[styles.title, { color: c.text }]}>No signal</Text>
      <Text style={[styles.body, { color: c.muted }]}>
        {snap ? "You can still train. Your sets save on this phone and sync later." : "Open the app once with signal so it can work offline."}
      </Text>
      {snap && (
        <View style={{ alignSelf: "stretch", gap: 10, marginTop: 12 }}>
          {active ? (
            <Pressable onPress={() => onStart(null)} style={[styles.primary, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.accentInk, fontSize: 18, fontWeight: "700" }}>Resume {active.name}</Text>
            </Pressable>
          ) : (
            <>
              {next && (
                <Pressable onPress={() => onStart(next.key)} style={[styles.primary, { backgroundColor: c.accent }]}>
                  <Text style={{ color: c.accentInk, fontSize: 18, fontWeight: "700" }}>Start {next.name}</Text>
                </Pressable>
              )}
              {routines
                .filter((r) => r.key !== next?.key)
                .map((r) => (
                  <Pressable key={r.key} onPress={() => onStart(r.key)} style={[styles.primary, { borderWidth: 1, borderColor: c.muted }]}>
                    <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>Start {r.name}</Text>
                  </Pressable>
                ))}
            </>
          )}
        </View>
      )}
      <Pressable onPress={onRetry} style={[styles.button, { borderColor: c.text }]}>
        <Text style={{ color: c.text, fontWeight: "600" }}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15, textAlign: "center" },
  button: { marginTop: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  primary: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
