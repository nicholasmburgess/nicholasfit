import type { Device, Subscription } from "react-native-ble-plx";
import type { RowPiece } from "@/lib/types";
import { ble, bytes, findDevice } from "./ble";

/**
 * Live data from a Concept2 PM5 monitor over Bluetooth, using Concept2's published
 * "PM5 Bluetooth Smart Communications Interface Definition". The PM5 sends its rowing status
 * twice a second; we read the time, distance, pace, stroke rate, watts and calories from it.
 *
 * The PM5 talks to one app at a time, so ErgData (or any other rowing app) must be closed.
 */

const uuid = (short: string) => `ce06${short}-43e5-11e4-916c-0800200c9a66`;
/** Every PM5 advertises this "discovery" service. */
const DISCOVERY = uuid("0000");
const ROWING = uuid("0030");
const C = {
  general: uuid("0031"),
  additional1: uuid("0032"),
  additional2: uuid("0033"),
  sampleRate: uuid("0034"),
  strokeExtra: uuid("0036"),
  summary: uuid("0039"),
};

export type Pm5Status = "off" | "bluetooth-off" | "searching" | "connected" | "error";

export type RowLive = {
  /** True while a piece is under way on the PM5 (from the first stroke until it's ended). */
  active: boolean;
  /** Strokes happening right now (the PM5 says "rowing" rather than paused). */
  moving: boolean;
  elapsedS: number;
  distanceM: number;
  /** Current pace, seconds per 500 m; null when not rowing. */
  splitS: number | null;
  avgSplitS: number | null;
  spm: number | null;
  watts: number | null;
  avgWatts: number | null;
  kcal: number | null;
  strokes: number | null;
  dragFactor: number | null;
  /** Heart rate the PM5 itself receives (a strap paired to the monitor), if any. */
  heartRate: number | null;
};

export type Pm5Update = { status: Pm5Status; device: string | null; live: RowLive | null; message?: string };

const u16 = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24 = (b: Uint8Array, i: number) => u16(b, i) | ((b[i + 2] ?? 0) << 16);

/** PM5 workout states that mean a piece is under way (rowing, countdown or an interval). */
const ACTIVE_STATES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
/** Workout end, terminated, logged. */
const ENDED_STATES = new Set([10, 11, 12]);

export class Pm5Session {
  private device: Device | null = null;
  private subs: Subscription[] = [];
  private stopped = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private cancelScan: (() => void) | null = null;
  private name: string | null = null;

  private live: RowLive = empty();
  private pieceStart: number | null = null;
  private spmSum = 0;
  private spmCount = 0;
  private lastElapsed = 0;

  /**
   * onUpdate: every status change and every data packet (about twice a second while rowing).
   * onPiece: once when a piece ends on the PM5 (or the monitor is reset for a new one).
   */
  constructor(
    private onUpdate: (u: Pm5Update) => void,
    private onPiece: (p: Omit<RowPiece, "avgHr" | "maxHr">) => void,
  ) {}

  start() {
    this.stopped = false;
    let scanning = false;
    this.subs.push(
      ble().onStateChange((state) => {
        if (this.stopped) return;
        if (state === "PoweredOn") {
          if (scanning) return;
          scanning = true;
          this.scan();
        } else if (state === "PoweredOff" || state === "Unauthorized") {
          this.emit("bluetooth-off", state === "Unauthorized" ? "Allow Bluetooth for Nicholasfit in Settings" : "Turn on Bluetooth");
        }
      }, true),
    );
  }

  /** The piece so far, if anything has been rowed. Used when the set is ticked by hand. */
  current(): Omit<RowPiece, "avgHr" | "maxHr"> | null {
    return this.pieceStart != null && this.live.distanceM > 0 ? this.piece() : null;
  }

  private emit(status: Pm5Status, message?: string) {
    this.onUpdate({ status, device: this.name, live: status === "connected" ? { ...this.live } : null, message });
  }

  private scan() {
    this.emit("searching");
    this.cancelScan?.();
    this.cancelScan = findDevice(DISCOVERY, (found) => {
      this.cancelScan = null;
      if (!this.stopped) this.connect(found);
    });
  }

  private async connect(found: Device) {
    try {
      const device = await found.connect({ timeout: 10000 });
      await device.discoverAllServicesAndCharacteristics();
      if (this.stopped) {
        device.cancelConnection().catch(() => {});
        return;
      }
      this.device = device;
      this.name = device.name ?? device.localName ?? "PM5";
      this.emit("connected");
      this.subs.push(
        device.onDisconnected(() => {
          this.device = null;
          if (this.stopped) return;
          this.emit("searching", "Rower disconnected. Reconnecting…");
          this.retry = setTimeout(() => this.scan(), 2000);
        }),
      );
      // Twice a second (0 = 1 s, 1 = 500 ms). Best effort: older firmware may refuse.
      device.writeCharacteristicWithResponseForService(ROWING, C.sampleRate, btoa(String.fromCharCode(1))).catch(() => {});
      const watch = (char: string, fn: (b: Uint8Array) => void) =>
        this.subs.push(
          device.monitorCharacteristicForService(ROWING, char, (err, ch) => {
            if (err || !ch?.value || this.stopped) return;
            try {
              fn(bytes(ch.value));
            } catch {
              // A malformed packet: skip it, the next one comes in half a second.
            }
          }),
        );
      watch(C.general, (b) => this.onGeneral(b));
      watch(C.additional1, (b) => this.onAdditional1(b));
      watch(C.additional2, (b) => this.onAdditional2(b));
      watch(C.strokeExtra, (b) => this.onStrokeExtra(b));
      watch(C.summary, () => this.endPiece());
    } catch (e) {
      if (this.stopped) return;
      this.emit("searching", e instanceof Error ? e.message : undefined);
      this.retry = setTimeout(() => this.scan(), 3000);
    }
  }

  /** 0x0031: elapsed time, distance, workout and rowing state, drag factor. */
  private onGeneral(b: Uint8Array) {
    const elapsedS = u24(b, 0) / 100;
    const distanceM = u24(b, 3) / 10;
    const workoutState = b[8];
    const rowingState = b[9];
    // The monitor was reset (clock went back) while a piece was going: close the old one first.
    if (this.pieceStart != null && elapsedS + 5 < this.lastElapsed) this.endPiece();
    this.lastElapsed = elapsedS;

    const active = ACTIVE_STATES.has(workoutState) && (elapsedS > 0 || distanceM > 0);
    if (active && this.pieceStart == null) {
      this.pieceStart = Date.now() - elapsedS * 1000;
      this.spmSum = 0;
      this.spmCount = 0;
    }
    this.live = { ...this.live, active: this.pieceStart != null, moving: rowingState === 1, elapsedS, distanceM, dragFactor: b[18] || null };
    if (ENDED_STATES.has(workoutState) && this.pieceStart != null) this.endPiece();
    else this.emit("connected");
  }

  /** 0x0032: current pace, average pace, stroke rate. */
  private onAdditional1(b: Uint8Array) {
    const spm = b[5] || null;
    const pace = u16(b, 7) / 100;
    const avgPace = u16(b, 9) / 100;
    const heartRate = b[6] > 0 && b[6] < 255 ? b[6] : null;
    if (spm && this.pieceStart != null && this.live.moving) {
      this.spmSum += spm;
      this.spmCount += 1;
    }
    this.live = { ...this.live, spm, splitS: pace > 0 ? pace : null, avgSplitS: avgPace > 0 ? avgPace : this.live.avgSplitS, heartRate };
    this.emit("connected");
  }

  /** 0x0033: average watts and total calories. */
  private onAdditional2(b: Uint8Array) {
    const avgWatts = u16(b, 4) || null;
    const kcal = u16(b, 6);
    this.live = { ...this.live, avgWatts: avgWatts ?? this.live.avgWatts, kcal: kcal || this.live.kcal };
  }

  /** 0x0036: power of the last stroke and the stroke count. */
  private onStrokeExtra(b: Uint8Array) {
    this.live = { ...this.live, watts: u16(b, 3) || null, strokes: u16(b, 7) || this.live.strokes };
  }

  private piece(): Omit<RowPiece, "avgHr" | "maxHr"> {
    const l = this.live;
    // Fall back to time ÷ distance when the PM5 hasn't sent an average pace yet.
    const avgSplit = l.avgSplitS ?? (l.distanceM > 0 ? (l.elapsedS / l.distanceM) * 500 : null);
    return {
      startedAt: new Date(this.pieceStart ?? Date.now() - l.elapsedS * 1000).toISOString(),
      seconds: Math.round(l.elapsedS),
      distanceM: Math.round(l.distanceM),
      avgSplitS: avgSplit ? Math.round(avgSplit * 10) / 10 : null,
      avgSpm: this.spmCount ? Math.round((this.spmSum / this.spmCount) * 10) / 10 : null,
      avgWatts: l.avgWatts,
      kcal: l.kcal,
      strokes: l.strokes,
      source: "pm5",
    };
  }

  private endPiece() {
    if (this.pieceStart == null) return;
    const p = this.piece();
    this.pieceStart = null;
    this.live = { ...this.live, active: false, moving: false };
    if (p.distanceM > 0) this.onPiece(p);
    this.emit("connected");
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
    this.onUpdate({ status: "off", device: null, live: null });
  }
}

function empty(): RowLive {
  return { active: false, moving: false, elapsedS: 0, distanceM: 0, splitS: null, avgSplitS: null, spm: null, watts: null, avgWatts: null, kcal: null, strokes: null, dragFactor: null, heartRate: null };
}
