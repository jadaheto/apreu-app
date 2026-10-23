import type { DeliverySummary } from '../views.js';

/** Builds a {@link DeliverySummary} from per-recipient outcomes. */
export const summarize = (
  outcomes: readonly { sent: boolean; error: string | null }[],
  recipientOf: (index: number) => string,
  skipped = 0,
): DeliverySummary => {
  const failures = outcomes.flatMap((outcome, index) =>
    outcome.sent ? [] : [{ to: recipientOf(index), error: outcome.error ?? 'Error desconocido' }],
  );
  return {
    total: outcomes.length + skipped,
    sent: outcomes.length - failures.length,
    failed: failures.length,
    skipped,
    failures,
  };
};
