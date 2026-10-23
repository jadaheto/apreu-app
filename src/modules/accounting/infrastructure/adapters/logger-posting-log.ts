import { Injectable, Logger } from '@nestjs/common';
import type { PostingLogPort } from '../../application/ports/posting-log.port.js';

/** Writes automatic-posting warnings to the application log. */
@Injectable()
export class LoggerPostingLog implements PostingLogPort {
  private readonly logger = new Logger('AsientosAutomaticos');

  warn(message: string, context: Record<string, unknown>): void {
    this.logger.warn(`${message} ${JSON.stringify(context)}`);
  }
}
