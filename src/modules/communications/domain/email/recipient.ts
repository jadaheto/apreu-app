import { Email } from '../../../../shared/domain/value-objects/email.vo.js';

/** A person who receives an e-mail. */
export interface Recipient {
  email: string;
  name: string | null;
}

/**
 * Normalizes, validates and de-duplicates recipients by e-mail
 * (RN-COM-03: one message per distinct address). Invalid addresses are
 * discarded, as the legacy `FILTER_VALIDATE_EMAIL` loop did.
 */
export const uniqueValidRecipients = (recipients: readonly Recipient[]): Recipient[] => {
  const byEmail = new Map<string, Recipient>();
  for (const recipient of recipients) {
    let email: string;
    try {
      email = Email.create(recipient.email).toString();
    } catch {
      continue;
    }
    if (!byEmail.has(email)) byEmail.set(email, { email, name: recipient.name?.trim() || null });
  }
  return [...byEmail.values()];
};
