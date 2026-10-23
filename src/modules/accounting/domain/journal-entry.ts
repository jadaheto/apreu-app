import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { CalendarDay } from './calendar-day.js';
import { JournalLine } from './journal-line.js';
import { VOUCHER_TYPES, type VoucherType } from './voucher-type.js';

export type JournalEntryStatus = 'draft' | 'posted' | 'voided';

/** Origin of an automatic entry, e.g. `{ type: 'finance.payment', id: '15' }`. */
export interface EntrySource {
  type: string;
  id: string;
}

export interface JournalEntryProps {
  periodId: number;
  date: string;
  type: VoucherType;
  number: string | null;
  description: string;
  status: JournalEntryStatus;
  lines: JournalLine[];
  createdBy: number | null;
  createdAt: Date | null;
  postedAt: Date | null;
  postedBy: number | null;
  voidedAt: Date | null;
  voidedBy: number | null;
  voidReason: string | null;
  source: EntrySource | null;
  reversalOfId: number | null;
}

export interface JournalEntryContent {
  periodId: number;
  date: string;
  type: VoucherType;
  description: string;
  lines: JournalLine[];
}

const sum = (amounts: Money[]): Money => amounts.reduce((acc, amount) => acc.add(amount), Money.zero());

/**
 * Journal entry / voucher (`accounting_journal_entries` + lines), legacy
 * `accounting/entries.php`.
 *
 * Lifecycle: `draft → posted → voided` (voided is final). Only drafts are
 * editable (RN-JE-10); posting checks double entry (RN-JE-02/03): at least two
 * lines, ΣD = ΣC > 0, each line with exactly one side. Rules that need other
 * aggregates (open period, date inside the period, transactional accounts)
 * live in {@link JournalEntryPolicy}.
 */
export class JournalEntry extends Entity<JournalEntryProps> {
  private constructor(id: EntityId, props: JournalEntryProps) {
    super(id, props);
  }

  static draft(
    content: JournalEntryContent,
    createdBy: number | null,
    source: EntrySource | null = null,
  ): JournalEntry {
    const entry = new JournalEntry(null, {
      periodId: 0,
      date: '',
      type: 'NI',
      number: null,
      description: '',
      status: 'draft',
      lines: [],
      createdBy,
      createdAt: null,
      postedAt: null,
      postedBy: null,
      voidedAt: null,
      voidedBy: null,
      voidReason: null,
      source,
      reversalOfId: null,
    });
    entry.applyContent(content);
    return entry;
  }

  /**
   * Draft counter-entry of a posted entry: same accounts with debit and
   * credit swapped. The original keeps its `posted` status (bug 9: the legacy
   * only flagged entries as voided, without a counter-entry).
   */
  static reversalOf(
    original: JournalEntry,
    header: Omit<JournalEntryContent, 'lines'>,
    createdBy: number | null,
    source: EntrySource | null = null,
  ): JournalEntry {
    if (original.status !== 'posted' || original.id === null) {
      throw new BusinessRuleViolationError('Sólo se pueden revertir asientos contabilizados.', 'ENTRY_NOT_POSTED');
    }
    const reversal = JournalEntry.draft(
      { ...header, lines: original.lines.map((line) => line.swapped()) },
      createdBy,
      source,
    );
    reversal.props.reversalOfId = original.id;
    return reversal;
  }

  static restore(id: number, props: JournalEntryProps): JournalEntry {
    return new JournalEntry(id, { ...props, lines: [...props.lines] });
  }

  get periodId(): number {
    return this.props.periodId;
  }
  get date(): string {
    return this.props.date;
  }
  get type(): VoucherType {
    return this.props.type;
  }
  get number(): string | null {
    return this.props.number;
  }
  /** `TIPO-NNNNNN`, or `null` while the entry is a draft. */
  get displayNumber(): string | null {
    return this.props.number ? `${this.props.type}-${this.props.number}` : null;
  }
  get description(): string {
    return this.props.description;
  }
  get status(): JournalEntryStatus {
    return this.props.status;
  }
  get lines(): readonly JournalLine[] {
    return this.props.lines;
  }
  get createdBy(): number | null {
    return this.props.createdBy;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }
  get postedAt(): Date | null {
    return this.props.postedAt;
  }
  get postedBy(): number | null {
    return this.props.postedBy;
  }
  get voidedAt(): Date | null {
    return this.props.voidedAt;
  }
  get voidedBy(): number | null {
    return this.props.voidedBy;
  }
  get voidReason(): string | null {
    return this.props.voidReason;
  }
  get source(): EntrySource | null {
    return this.props.source;
  }
  get reversalOfId(): number | null {
    return this.props.reversalOfId;
  }
  /** RN-JE-04: header totals are always the sums of the lines. */
  get totalDebit(): Money {
    return sum(this.props.lines.map((line) => line.debit));
  }
  get totalCredit(): Money {
    return sum(this.props.lines.map((line) => line.credit));
  }
  get isBalanced(): boolean {
    return this.totalDebit.equals(this.totalCredit) && this.totalDebit.isGreaterThan(Money.zero());
  }

  /** Replaces header and lines of a draft. */
  updateDraft(content: JournalEntryContent): void {
    this.assertStatus('draft', 'Sólo se pueden editar asientos en borrador.', 'ENTRY_NOT_DRAFT');
    this.applyContent(content);
  }

  /** Assigns the consecutive and books the entry. */
  post(number: string, by: number | null, at: Date): void {
    this.assertStatus('draft', 'El asiento ya fue contabilizado o anulado.', 'ENTRY_NOT_DRAFT');
    this.assertDoubleEntry();
    Guard.againstEmpty(number, 'consecutivo');
    this.props.number = number;
    this.props.status = 'posted';
    this.props.postedAt = at;
    this.props.postedBy = by;
  }

  /** RN-JE-07 (bug 9): only posted entries can be voided, with a reason and audit data. */
  void(by: number, at: Date, reason: string): void {
    this.assertStatus('posted', 'Sólo se pueden anular asientos contabilizados.', 'ENTRY_NOT_POSTED');
    const trimmed = reason?.trim();
    Guard.againstEmpty(trimmed, 'motivo de anulación');
    Guard.againstMaxLength(trimmed, 255, 'motivo de anulación');
    this.props.status = 'voided';
    this.props.voidedAt = at;
    this.props.voidedBy = by;
    this.props.voidReason = trimmed;
  }

  private applyContent(content: JournalEntryContent): void {
    const description = content.description?.trim();
    Guard.againstEmpty(description, 'descripción del asiento');
    Guard.againstMaxLength(description, 255, 'descripción del asiento');
    Guard.oneOf(content.type, VOUCHER_TYPES, 'tipo de comprobante');
    if (!Number.isInteger(content.periodId) || content.periodId <= 0) {
      throw new BusinessRuleViolationError('Seleccione un periodo contable.', 'PERIOD_REQUIRED');
    }
    if (content.lines.length === 0) {
      throw new BusinessRuleViolationError('El asiento debe tener al menos una línea.', 'ENTRY_WITHOUT_LINES');
    }
    this.props.periodId = content.periodId;
    this.props.date = CalendarDay.parse(content.date, 'fecha del asiento');
    this.props.type = content.type;
    this.props.description = description;
    this.props.lines = [...content.lines];
  }

  private assertDoubleEntry(): void {
    if (this.props.lines.length < 2) {
      throw new BusinessRuleViolationError('El asiento debe tener al menos dos líneas.', 'ENTRY_TOO_FEW_LINES');
    }
    if (!this.isBalanced) {
      throw new BusinessRuleViolationError(
        `El asiento no está cuadrado: Débitos (${this.totalDebit.format()}) ≠ Créditos (${this.totalCredit.format()}). ` +
          'En partida doble ambos deben ser iguales y mayores que cero.',
        'ENTRY_NOT_BALANCED',
        { totalDebit: this.totalDebit.amount, totalCredit: this.totalCredit.amount },
      );
    }
  }

  private assertStatus(expected: JournalEntryStatus, message: string, code: string): void {
    if (this.props.status !== expected) throw new BusinessRuleViolationError(message, code);
  }
}
