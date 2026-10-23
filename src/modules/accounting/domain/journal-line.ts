import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';

export interface JournalLineProps {
  accountId: number;
  thirdPartyId: number | null;
  description: string | null;
  debit: Money;
  credit: Money;
}

/**
 * Line of a journal entry (`accounting_journal_lines`).
 *
 * RN-JE-03 (stricter than legacy, bug 7): amounts are non-negative and
 * exactly one of debit/credit is greater than zero.
 */
export class JournalLine {
  private constructor(private readonly props: JournalLineProps) {
    Object.freeze(this);
  }

  static create(input: {
    accountId: number;
    thirdPartyId?: number | null;
    description?: string | null;
    debit?: Money;
    credit?: Money;
  }): JournalLine {
    const debit = input.debit ?? Money.zero();
    const credit = input.credit ?? Money.zero();
    if (!Number.isInteger(input.accountId) || input.accountId <= 0) {
      throw new BusinessRuleViolationError('Cada línea debe indicar una cuenta contable.', 'LINE_ACCOUNT_REQUIRED');
    }
    if (debit.isNegative() || credit.isNegative()) {
      throw new BusinessRuleViolationError('Los débitos y créditos no pueden ser negativos.', 'NEGATIVE_LINE_AMOUNT');
    }
    if (debit.isZero() === credit.isZero()) {
      throw new BusinessRuleViolationError(
        'Cada línea debe tener un valor en débito o en crédito, no en ambos.',
        'INVALID_LINE_AMOUNT',
      );
    }
    const description = input.description?.trim() || null;
    Guard.againstMaxLength(description, 255, 'detalle de la línea');
    return new JournalLine({
      accountId: input.accountId,
      thirdPartyId: input.thirdPartyId ?? null,
      description,
      debit,
      credit,
    });
  }

  /** Rebuilds a stored line without validation. */
  static restore(props: JournalLineProps): JournalLine {
    return new JournalLine({ ...props });
  }

  get accountId(): number {
    return this.props.accountId;
  }
  get thirdPartyId(): number | null {
    return this.props.thirdPartyId;
  }
  get description(): string | null {
    return this.props.description;
  }
  get debit(): Money {
    return this.props.debit;
  }
  get credit(): Money {
    return this.props.credit;
  }

  /** Same line with debit and credit swapped (used by reversals). */
  swapped(): JournalLine {
    return new JournalLine({ ...this.props, debit: this.props.credit, credit: this.props.debit });
  }
}
