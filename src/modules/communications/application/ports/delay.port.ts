/** Waits between delivery batches (rate limiting). Replaced by an instant fake in tests. */
export interface DelayPort {
  wait(ms: number): Promise<void>;
}

export const DELAY = Symbol('DelayPort');
