import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPolicy } from '../../domain/common/delivery-policy.js';
import { DELAY, type DelayPort } from '../ports/delay.port.js';

/**
 * Processes bulk deliveries in batches of `policy.batchSize`, pausing
 * `policy.pauseMs` between batches (analysis §6.5, legacy bug #16).
 *
 * Items are handled one at a time so a slow provider is never hit with
 * parallel connections; the handler must not throw (failures are recorded
 * as results by the delivery services).
 */
@Injectable()
export class RateLimitedDispatcher {
  constructor(@Inject(DELAY) private readonly delay: DelayPort) {}

  async run<TItem, TResult>(
    items: readonly TItem[],
    policy: DeliveryPolicy,
    handler: (item: TItem) => Promise<TResult>,
  ): Promise<TResult[]> {
    const results: TResult[] = [];
    for (const [index, item] of items.entries()) {
      if (index > 0 && index % policy.batchSize === 0 && policy.pauseMs > 0) {
        await this.delay.wait(policy.pauseMs);
      }
      results.push(await handler(item));
    }
    return results;
  }
}
