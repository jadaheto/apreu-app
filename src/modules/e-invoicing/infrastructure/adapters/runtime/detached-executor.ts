import { Injectable, Logger, Optional } from '@nestjs/common';
import { BackgroundTasks } from '../../../../../shared/infrastructure/runtime/background-tasks.js';
import type { BackgroundExecutorPort } from '../../../application/ports/background-executor.port.js';

/**
 * Runs the task on the next turn of the event loop, after the current
 * request answered. `AsyncLocalStorage` propagates into `setImmediate`, so the
 * task keeps the tenant (school) of the request. Failures are logged; documents
 * left `signed`/`send_error` are recovered by "retry pending submissions".
 * Tasks are tracked in {@link BackgroundTasks} so a graceful shutdown waits for them.
 */
@Injectable()
export class DetachedExecutor implements BackgroundExecutorPort {
  private readonly logger = new Logger(DetachedExecutor.name);

  constructor(@Optional() private readonly backgroundTasks: BackgroundTasks = new BackgroundTasks()) {}

  run(taskName: string, task: () => Promise<unknown>): void {
    this.backgroundTasks.track(
      new Promise<void>((resolve) => {
        setImmediate(() => {
          task()
            .catch((error: Error) =>
              this.logger.error(`Tarea en segundo plano "${taskName}" falló: ${error.message}`, error.stack),
            )
            .finally(resolve);
        });
      }),
    );
  }
}
