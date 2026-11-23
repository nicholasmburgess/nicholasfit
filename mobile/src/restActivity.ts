import { Platform } from "react-native";
import type { LiveActivity } from "expo-widgets";
import RestTimer, { type RestProps } from "../widgets/RestTimer";

/**
 * The rest timer on the Lock Screen and Dynamic Island (a Live Activity). Started and updated
 * from the workout screen; iOS counts it down without the app. Never throws: if Live Activities
 * are off (Settings → Nicholasfit → Live Activities) the notification and on-screen timer still work.
 */
let current: LiveActivity<RestProps> | null = null;

export function showRest(props: RestProps) {
  if (Platform.OS !== "ios") return;
  const stale = new Date(props.endsAt);
  try {
    if (current) {
      current.update(props, stale).catch(() => {});
      return;
    }
    current = RestTimer.start(props, "nicholasfit://", stale);
  } catch {
    current = null;
  }
}

export function endRest() {
  const a = current;
  current = null;
  a?.end("immediate").catch(() => {});
}

/** Clear any timer left on the Lock Screen from before the app was closed. */
export function endAllRests() {
  current = null;
  if (Platform.OS !== "ios") return;
  try {
    RestTimer.getInstances().forEach((a) => a.end("immediate").catch(() => {}));
  } catch {
    // Not supported on this iOS version.
  }
}
