import { Guard } from '../../../../shared/domain/guard.js';

/**
 * Throughput limits for bulk deliveries (analysis §6.5, legacy bug #16: the
 * PHP code sent everything in a tight loop without any limit).
 *
 * Messages are sent in batches of `batchSize`; between two batches the
 * sender pauses `pauseMs` milliseconds.
 */
export interface DeliveryPolicy {
  batchSize: number;
  pauseMs: number;
}

/** Defaults: ~10 e-mails per 2 s keeps shared SMTP hosts (Hostinger) under their hourly quotas. */
export const DEFAULT_EMAIL_POLICY: DeliveryPolicy = { batchSize: 10, pauseMs: 2_000 };

/** Defaults: 20 messages per second is well below Meta's lowest Cloud API throughput tier. */
export const DEFAULT_WHATSAPP_POLICY: DeliveryPolicy = { batchSize: 20, pauseMs: 1_000 };

/** Validates a policy coming from configuration. */
export const assertDeliveryPolicy = (policy: DeliveryPolicy): void => {
  Guard.inRange(policy.batchSize, 1, 500, 'tamaño de lote');
  Guard.inRange(policy.pauseMs, 0, 60_000, 'pausa entre lotes');
};
