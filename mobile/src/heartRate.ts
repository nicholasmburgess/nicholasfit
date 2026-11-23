import type { Device, Subscription } from "react-native-ble-plx";
import { ble, bytes as toBytes, findDevice } from "./ble";

/** Standard Bluetooth Heart Rate service, used by Polar, Garmin, Wahoo and most chest straps. */
const HR_SERVICE = "0000180d-0000-1000-8000-00805f9b34fb";
const HR_MEASUREMENT = "00002a37-0000-1000-8000-00805f9b34fb";

export type HrStatus = "off" | "bluetooth-off" | "searching" | "connected" | "error";
export type HrUpdate = { status: HrStatus; bpm: number | null; device: string | null; message?: string };
export type HrSample = { at: number; bpm: number };

/** Heart rate in bpm from a Heart Rate Measurement value (base64). Flags bit 0 says 8- or 16-bit. */
export function parseHeartRate(base64: string): number | null {
  const bytes = toBytes(base64);
  if (bytes.length < 2) return null;
  const bpm = bytes[0] & 0x01 ? bytes[1] | (bytes[2] << 8) : bytes[1];
  return bpm > 0 && bpm < 255 ? bpm : null;
}

/**
 * Finds the nearest heart rate strap, connects, and streams bpm until stop() is called.
 * Reconnects by itself if the strap drops out (e.g. it was briefly out of range).
 */
export class HeartRateSession {
  samples: HrSample[] = [];
  private device: Device | null = null;
  private subs: Subscription[] = [];
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private cancelScan: (() => void) | null = null;

  constructor(private onUpdate: (u: HrUpdate) => void) {}

  start() {
    this.stopped = false;
    let scanning = false;
    const stateSub = ble().onStateChange((state) => {
      if (this.stopped) return;
      if (state === "PoweredOn") {
        if (scanning) return;
        scanning = true;
        this.scan();
      } else if (state === "PoweredOff" || state === "Unauthorized") {
        this.onUpdate({ status: "bluetooth-off", bpm: null, device: null, message: state === "Unauthorized" ? "Allow Bluetooth for Nicholasfit in Settings" : "Turn on Bluetooth" });
      }
    }, true);
    this.subs.push(stateSub);
  }

  private scan() {
    this.onUpdate({ status: "searching", bpm: null, device: null });
    this.cancelScan?.();
    this.cancelScan = findDevice(HR_SERVICE, (found) => {
      this.cancelScan = null;
      if (!this.stopped) this.connect(found);
    });
  }

  private async connect(found: Device) {
    try {
      const device = await found.connect();
      await device.discoverAllServicesAndCharacteristics();
      if (this.stopped) {
        device.cancelConnection().catch(() => {});
        return;
      }
      this.device = device;
      const name = device.name ?? device.localName ?? "Heart rate strap";
      this.onUpdate({ status: "connected", bpm: null, device: name });
      this.subs.push(
        device.onDisconnected(() => {
          this.device = null;
          if (!this.stopped) this.retry = setTimeout(() => this.scan(), 2000);
        }),
      );
      this.subs.push(
        device.monitorCharacteristicForService(HR_SERVICE, HR_MEASUREMENT, (err, ch) => {
          if (err || !ch?.value) return;
          const bpm = parseHeartRate(ch.value);
          if (bpm == null) return;
          this.samples.push({ at: Date.now(), bpm });
          this.onUpdate({ status: "connected", bpm, device: name });
        }),
      );
    } catch (e) {
      if (this.stopped) return;
      this.onUpdate({ status: "searching", bpm: null, device: null, message: e instanceof Error ? e.message : undefined });
      this.retry = setTimeout(() => this.scan(), 3000);
    }
  }

  stop() {
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.cancelScan?.();
    this.cancelScan = null;
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.device?.cancelConnection().catch(() => {});
    this.device = null;
    this.onUpdate({ status: "off", bpm: null, device: null });
  }
}

/** One sample every 5 s at most, so a 45-minute session writes ~540 points to Apple Health. */
export function thin(samples: HrSample[], from: number, to: number, everyMs = 5000): HrSample[] {
  const out: HrSample[] = [];
  for (const s of samples) {
    if (s.at < from || s.at > to) continue;
    if (!out.length || s.at - out[out.length - 1].at >= everyMs) out.push(s);
  }
  return out;
}
