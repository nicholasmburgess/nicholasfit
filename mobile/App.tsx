import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { authorize, healthAvailable, readHealth, saveStrengthWorkout } from "./src/health";
import { HeartRateSession, thin } from "./src/heartRate";

/** The web app this shell shows. Everything except Health and Bluetooth lives there. */
const APP_URL = "https://nicholasfit.vercel.app";
const APP_HOST = new URL(APP_URL).host;
/** Hosts that sign-in flows (Withings) open inside the app rather than in Safari. */
const IN_APP_HOSTS = [APP_HOST, "account.withings.com"];
const BRIDGE_VERSION = 1;

type FromWeb =
  | { type: "hello" }
  | { type: "healthSync"; days?: number }
  | { type: "hrStart" }
  | { type: "hrStop" }
  | { type: "workoutFinished"; id: string; name: string; startedAt: string; finishedAt: string };

const COLORS = {
  light: { bg: "#f4f6f5", text: "#0b4d34", muted: "#66706b" },
  dark: { bg: "#0a0f0c", text: "#eef2ec", muted: "#8f9b93" },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const c = COLORS[scheme];
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const hr = useRef<HeartRateSession | null>(null);
  const [failed, setFailed] = useState(false);

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

  const stopHr = useCallback(() => {
    hr.current?.stop();
    hr.current = null;
    deactivateKeepAwake("workout");
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
          send({ type: "native", version: BRIDGE_VERSION, health: healthAvailable(), bluetooth: true });
          break;
        case "healthSync":
          syncHealth(msg.days);
          break;
        case "hrStart":
          activateKeepAwakeAsync("workout").catch(() => {});
          if (!hr.current) {
            hr.current = new HeartRateSession((u) => send({ type: "hr", ...u }));
            hr.current.start();
          }
          break;
        case "hrStop":
          stopHr();
          break;
        case "workoutFinished": {
          const from = Date.parse(msg.startedAt);
          const to = Date.parse(msg.finishedAt);
          const samples = thin(hr.current?.samples ?? [], from, to);
          stopHr();
          if (!healthAvailable()) break;
          try {
            await authorize();
            const stats = await saveStrengthWorkout(msg, samples);
            send({ type: "workoutSaved", id: msg.id, ...stats });
          } catch (err) {
            send({ type: "workoutSaved", id: msg.id, error: err instanceof Error ? err.message : "Couldn't save to Apple Health" });
          }
          break;
        }
      }
    },
    [send, syncHealth, stopHr],
  );

  // Tell the page whenever the app comes back to the front so it can refresh (and re-sync Health).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && send({ type: "resumed" }));
    return () => sub.remove();
  }, [send]);

  useEffect(() => stopHr, [stopHr]);

  if (failed)
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <Text style={[styles.title, { color: c.text }]}>Can't reach Nicholasfit</Text>
        <Text style={[styles.body, { color: c.muted }]}>Check your internet connection and try again.</Text>
        <Pressable onPress={() => setFailed(false)} style={[styles.button, { borderColor: c.text }]}>
          <Text style={{ color: c.text, fontWeight: "600" }}>Try again</Text>
        </Pressable>
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
        onError={() => setFailed(true)}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  body: { fontSize: 15, textAlign: "center" },
  button: { marginTop: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
});
