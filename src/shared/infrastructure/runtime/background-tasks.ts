import { Injectable } from '@nestjs/common';

/** Upper bound for waiting on in-flight background work during shutdown. */
const DEFAULT_DRAIN_TIMEOUT_MS = 10_000;

/**
 * Registry of fire-and-forget work started after a response was sent (the
 * per-request access audit, DIAN submissions). `TenantConnectionManager`
 * drains it before closing the school pools, so a graceful shutdown (deploy,
 * `app.close()` in tests) does not cut those writes with "Connection terminated".
 */
@Injectable()
export class BackgroundTasks {
  private readonly pending = new Set<Promise<unknown>>();

  /** Registers `task` until it settles and returns it unchanged. */
  track<T>(task: Promise<T>): Promise<T> {
    this.pending.add(task);
    const forget = () => this.pending.delete(task);
    task.then(forget, forget);
    return task;
  }

  get size(): number {
    return this.pending.size;
  }

  /** Waits (bounded) until every tracked task settles, including those started meanwhile. */
  async drain(timeoutMs = DEFAULT_DRAIN_TIMEOUT_MS): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
      timer.unref();
    });
    const settleAll = async () => {
      while (this.pending.size > 0) await Promise.allSettled(this.pending);
    };
    await Promise.race([settleAll(), timeout]);
    clearTimeout(timer);
  }
}
