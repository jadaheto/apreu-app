import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import type { BankFile, CollectionFileBank } from '../domain/bank-files/bank-file.js';
import { CollectionFile, type CollectionEntry } from '../domain/bank-files/collection-file.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { Calendar } from '../domain/calendar.js';
import { FINANCE_SETTINGS, type FinanceSettingsPort } from '../domain/finance-settings.port.js';
import { CHARGE_QUERIES, type ChargeQueriesPort } from './ports/charge-queries.port.js';

/**
 * Student collection TXT for the bank (legacy `finance/bank_files.php`,
 * "recaudo"): one line per student with the real pending balance of the
 * open charges (pending, partial or overdue) billed in the month.
 */
@Injectable()
export class GenerateCollectionFileUseCase implements UseCase<{ bank: CollectionFileBank; month: string }, BankFile> {
  constructor(
    @Inject(CHARGE_QUERIES) private readonly charges: ChargeQueriesPort,
    @Inject(FINANCE_SETTINGS) private readonly settings: FinanceSettingsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute({ bank, month }: { bank: CollectionFileBank; month: string }): Promise<BankFile> {
    const rows = await this.charges.collectibleForPeriod(BillingPeriod.create(month));
    const byStudent = new Map<number, CollectionEntry>();
    for (const row of rows) {
      const current = byStudent.get(row.studentId);
      const amount = Money.of(row.pendingAmount);
      if (current) current.amount = current.amount.add(amount);
      else byStudent.set(row.studentId, { reference: this.reference(row.documentNumber, row.studentId), amount });
    }
    const entries = [...byStudent.values()].filter((entry) => entry.amount.amount >= 1);
    if (entries.length === 0) {
      throw new BusinessRuleViolationError(
        'No hay cargos pendientes para el mes seleccionado.',
        'NO_RECORDS_FOR_BANK_FILE',
      );
    }
    const today = Calendar.today(this.clock.now());
    const { schoolNit } = await this.settings.load();
    return {
      fileName: `RECAUDO_${bank.toUpperCase()}_${Calendar.compact(today)}.txt`,
      content: CollectionFile.build({ nit: schoolNit, date: today, entries }),
      records: entries.length,
    };
  }

  /** Student document digits; the student id when it has none (legacy produced `000…0`, bug B34). */
  private reference(documentNumber: string | null, studentId: number): string {
    return documentNumber?.replace(/\D/g, '') || String(studentId);
  }
}
