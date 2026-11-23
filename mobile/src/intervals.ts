import type { RepStat, RowSession, Segment } from "@/lib/row-sessions";
import { segmentAt } from "@/lib/row-sessions";
import type { RowLive } from "./pm5";

export type IntervalState = {
  seg: Segment;
  index: number;
  /** Seconds left in this part. */
  left: number;
  /** Hard rep number (1-based) this part belongs to; 0 before the first. */
  rep: number;
  done: boolean;
  next: Segment | null;
};

/**
 * Follows a guided row on the PM5's clock and records each hard rep: time, metres, split,
 * stroke rate, watts, peak heart rate, and heart rate at the end of the easy part after it.
 */
export class IntervalTracker {
  reps: RepStat[] = [];
  private cur: { index: number; startS: number; startM: number; spm: number[]; watts: number[]; maxHr: number | null } | null = null;
  private lastElapsed = 0;

  constructor(readonly session: RowSession) {}

  update(live: RowLive | null, bpm: number | null): IntervalState | null {
    if (!live?.active) return null;
    // A new piece on the PM5: start the session again.
    if (live.elapsedS + 5 < this.lastElapsed) {
      this.reps = [];
      this.cur = null;
    }
    this.lastElapsed = live.elapsedS;
    const at = segmentAt(this.session, live.elapsedS);
    if (!this.cur || this.cur.index !== at.index) {
      this.close(live, bpm);
      this.cur = { index: at.index, startS: live.elapsedS, startM: live.distanceM, spm: [], watts: [], maxHr: null };
    }
    if (at.seg.kind === "work") {
      if (live.moving && live.spm) this.cur.spm.push(live.spm);
      if (live.moving && live.watts) this.cur.watts.push(live.watts);
      if (bpm != null) this.cur.maxHr = Math.max(this.cur.maxHr ?? 0, bpm);
    }
    return { seg: at.seg, index: at.index, left: Math.max(0, Math.ceil(at.left)), rep: at.rep, done: at.done, next: this.session.segments[at.index + 1] ?? null };
  }

  /** The part that just ended: a hard rep is saved; an easy part notes how far heart rate came down. */
  private close(live: RowLive, bpm: number | null) {
    const c = this.cur;
    if (!c) return;
    const seg = this.session.segments[c.index];
    const mean = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
    if (seg?.kind === "work") {
      const seconds = Math.round(live.elapsedS - c.startS);
      const distanceM = Math.round(live.distanceM - c.startM);
      if (seconds > 5 && distanceM > 0)
        this.reps.push({
          rep: this.reps.length + 1,
          seconds,
          distanceM,
          splitS: Math.round(((seconds / distanceM) * 500) * 10) / 10,
          avgSpm: mean(c.spm),
          avgWatts: mean(c.watts),
          maxHr: c.maxHr,
          hrAfterEasy: null,
        });
    } else if (seg?.kind === "easy" && this.reps.length) {
      this.reps[this.reps.length - 1].hrAfterEasy = bpm;
    }
  }

  /** Close the part in progress (the session ended or was stopped early). */
  finish(live: RowLive | null, bpm: number | null) {
    if (live) this.close(live, bpm);
    this.cur = null;
    return this.reps;
  }
}
