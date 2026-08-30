// ─── stepDebugStore.ts ────────────────────────────────────────────────────────
//
// Holds the most recent step resolution produced by the pipeline so the Step
// Sources debug screen can display what ACTUALLY happened.
//
// The old debug screen re-derived every source itself, with a different Health
// Connect algorithm and a different time window than the pipeline used, and then
// displayed the persisted total next to those unrelated numbers. That is why it
// could show "1,720 + 571 + 0 + 0 + 0" above a final value of 7,097: the rows and
// the total came from different computations, so there was no arithmetic that
// connected them and no way to tell where the number came from.
//
// Nothing here is persisted — it is a live view of the last resolve, and it is
// deliberately the only thing the debug screen reads for the decision itself.

import { create } from 'zustand';
import type { StepResolution } from '../service/stepEngine';
import type { StepOriginTotal, StepsReadResult } from '../service/healthConnect.service';

export interface StepDebugSnapshot {
  /** The pipeline's decision, including every rejected source and why. */
  resolution: StepResolution;
  /** Per-origin Health Connect totals behind the health_connect reading. */
  hcOrigins: StepOriginTotal[];
  /** How the Health Connect figure was derived (single origin, slot dedup, ...). */
  hcMethod: string;
  /**
   * The full Health Connect read behind this resolution — origin contributions,
   * the hour-by-hour breakdown, and the timestamps of the underlying records.
   *
   * Kept here rather than only in the debug screen because the sync path needs
   * it too: this is the provenance sent to the server with the step count (see
   * stepProvenance.ts). Null on iOS and whenever Health Connect was not the
   * source, which is itself the reason the sync must consult `resolution.winner`
   * before attributing anything to it.
   */
  stepRead: StepsReadResult | null;
  /** Which platform the reading came from. */
  platform: string;
  serverBaselineDate: string | null;
  bonusStepsDate: string | null;
  /** What this device last synced today, used for server echo detection. */
  lastPushedSteps: number;
  lastPushedStepsDate: string | null;
  /** When this snapshot was taken (epoch ms). */
  at: number;
}

interface StepDebugStore {
  snapshot: StepDebugSnapshot | null;
  setSnapshot: (snapshot: StepDebugSnapshot) => void;
  clear: () => void;
}

export const useStepDebugStore = create<StepDebugStore>((set) => ({
  snapshot: null,
  setSnapshot: (snapshot) => set({ snapshot }),
  clear: () => set({ snapshot: null }),
}));
