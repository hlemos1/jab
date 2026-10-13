import type { StationId } from './effort';
import type { RunProjection, RunState, Timing } from './class-run';

/** Shared test-class view. Athletes receive only their own assignment. */
export type UnitClass = {
  id: string; unitId: string; name: string; createdAt: string; updatedAt: string;
  revision: number; timing: Timing; state: RunState; clock: RunProjection;
  athletes: { memberId: string; name: string; stations: StationId[] }[];
};
