import { Injectable, Logger } from '@nestjs/common';
import type { EventBusPort, EventHandler, IntegrationEvent } from '../../application/ports/event-bus.port.js';

/**
 * Synchronous in-process bus. Handlers are awaited in subscription order
 * within the same request (and therefore the same tenant context).
 */
@Injectable()
export class InProcessEventBus implements EventBusPort {
  private readonly logger = new Logger(InProcessEventBus.name);
  private readonly handlers = new Map<string, EventHandler[]>();

  subscribe(eventName: string, handler: EventHandler): void {
    this.handlers.set(eventName, [...(this.handlers.get(eventName) ?? []), handler]);
  }

  async publish(event: IntegrationEvent): Promise<void> {
    for (const handler of this.handlers.get(event.name) ?? []) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Manejador de "${event.name}" falló: ${(error as Error).message}`, (error as Error).stack);
      }
    }
  }
}
