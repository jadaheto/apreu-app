/**
 * Runs work after the current request without blocking it (e.g. sending a
 * document to the DIAN after a payment). Implementations must keep the tenant
 * context and log failures; documents left unsent are recovered with the
 * "retry pending submissions" use case.
 */
export interface BackgroundExecutorPort {
  run(taskName: string, task: () => Promise<unknown>): void;
}

export const BACKGROUND_EXECUTOR = Symbol('BackgroundExecutorPort');
