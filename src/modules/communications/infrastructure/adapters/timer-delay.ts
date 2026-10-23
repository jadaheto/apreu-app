import { setTimeout as sleep } from 'node:timers/promises';
import type { DelayPort } from '../../application/ports/delay.port.js';

/** Real pause between delivery batches. */
export class TimerDelay implements DelayPort {
  async wait(ms: number): Promise<void> {
    await sleep(ms);
  }
}
