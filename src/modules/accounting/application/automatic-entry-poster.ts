import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import { EVENT_BUS, type EventBusPort } from '../../../shared/application/ports/event-bus.port.js';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import { DomainError } from '../../../shared/domain/domain-error.js';
import type { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { CalendarDay } from '../domain/calendar-day.js';
import { JournalEntry, type EntrySource } from '../domain/journal-entry.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';
import { JournalLine } from '../domain/journal-line.js';
import { POSTING_RULE_REPOSITORY, type PostingRuleRepository } from '../domain/posting-rule.repository.js';
import type { VoucherType } from '../domain/voucher-type.js';
import { ACCOUNTING_EVENTS, type AutomaticEntrySkippedPayload } from './integration-events.js';
import { JournalEntryBooker } from './journal-entry-booker.js';
import { POSTING_LOG, type PostingLogPort } from './ports/posting-log.port.js';

/** One side of an automatic entry; the account comes from the first configured rule key. */
export interface AutomaticLine {
  ruleKeys: string[];
  side: 'debit' | 'credit';
  amount: Money;
  description: string;
}

export interface AutomaticEntryRequest {
  source: EntrySource;
  /** ISO date or date-time; converted to the Colombian calendar day. */
  date: string;
  type: VoucherType;
  description: string;
  lines: AutomaticLine[];
}

export interface AutomaticReversalRequest {
  original: EntrySource;
  source: EntrySource;
  date: string;
  description: string;
}

export type AutomaticPostingResult =
  { status: 'posted'; entryId: number; displayNumber: string } | { status: 'skipped'; reason: string };

/** A skip that must be reported (log + `accounting.automatic-entry-skipped`). */
interface ReportedSkip {
  status: 'skipped';
  reason: string;
  message: string;
  details: Record<string, unknown>;
}

type WorkResult = AutomaticPostingResult | ReportedSkip;

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Anti-corruption layer that turns facts of other contexts into posted
 * journal entries (the legacy had no integration: accounting was 100 %
 * manual).
 *
 * - Idempotent by source (`source_type`, `source_id`): redelivered events do
 *   not duplicate entries.
 * - Never fails the publisher: when the parametrization is missing, there is
 *   no open period or a rule is violated, it skips the entry, records a
 *   warning and publishes `accounting.automatic-entry-skipped` (after the
 *   transaction) so the school can be notified and fix the parametrization
 *   (`POST /api/accounting/posting-rules/defaults` loads a default one).
 */
@Injectable()
export class AutomaticEntryPoster {
  constructor(
    private readonly booker: JournalEntryBooker,
    @Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository,
    @Inject(POSTING_RULE_REPOSITORY) private readonly rules: PostingRuleRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(POSTING_LOG) private readonly log: PostingLogPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  post(request: AutomaticEntryRequest): Promise<AutomaticPostingResult> {
    return this.guarded(request.source, async (): Promise<WorkResult> => {
      if (await this.entries.findBySource(request.source.type, request.source.id)) return this.alreadyPosted();
      const ruleAccounts = new Map((await this.rules.findAll()).map((rule) => [rule.key, rule.accountId]));
      const relevant = request.lines.filter((line) => !line.amount.isZero());
      const missing = relevant.filter((line) => !line.ruleKeys.some((key) => ruleAccounts.has(key)));
      if (missing.length > 0) {
        return this.skip('MISSING_POSTING_RULE', 'No hay cuentas parametrizadas para el asiento automático.', {
          missingKeys: missing.map((line) => line.ruleKeys),
        });
      }
      const lines = relevant.map((line) =>
        JournalLine.create({
          accountId: ruleAccounts.get(line.ruleKeys.find((key) => ruleAccounts.has(key)) as string) as number,
          description: line.description,
          [line.side]: line.amount,
        }),
      );
      const date = this.toDay(request.date);
      const period = await this.booker.openPeriodFor(date);
      const entry = JournalEntry.draft(
        { periodId: period.id as number, date, type: request.type, description: request.description, lines },
        null,
        request.source,
      );
      await this.booker.post(entry, null, this.clock.now());
      return this.posted(entry);
    });
  }

  reverse(request: AutomaticReversalRequest): Promise<AutomaticPostingResult> {
    return this.guarded(request.source, async (): Promise<WorkResult> => {
      if (await this.entries.findBySource(request.source.type, request.source.id)) return this.alreadyPosted();
      const original = await this.entries.findBySource(request.original.type, request.original.id);
      if (!original || original.status !== 'posted') {
        return this.skip('ORIGINAL_ENTRY_NOT_FOUND', 'No existe un asiento automático contabilizado para revertir.', {
          original: request.original,
        });
      }
      const date = this.toDay(request.date);
      const period = await this.booker.openPeriodFor(date);
      const reversal = JournalEntry.reversalOf(
        original,
        { periodId: period.id as number, date, type: 'NI', description: request.description.slice(0, 255) },
        null,
        request.source,
      );
      await this.booker.post(reversal, null, this.clock.now());
      return this.posted(reversal);
    });
  }

  /** Runs the work atomically; business errors become reported skips. */
  private async guarded(source: EntrySource, work: () => Promise<WorkResult>): Promise<AutomaticPostingResult> {
    let result: WorkResult;
    try {
      result = await this.uow.runInTransaction(work);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      result = this.skip(error.code, error.message, error.details ?? {});
    }
    if ('message' in result) {
      await this.report(source, result);
      return { status: 'skipped', reason: result.reason };
    }
    return result;
  }

  private async report(source: EntrySource, skip: ReportedSkip): Promise<void> {
    this.log.warn(`Asiento automático omitido (${source.type} #${source.id}): ${skip.message}`, {
      reason: skip.reason,
      source,
      ...skip.details,
    });
    const missingKeys = skip.details.missingKeys;
    const payload: AutomaticEntrySkippedPayload = {
      sourceType: source.type,
      sourceId: source.id,
      reason: skip.reason,
      message: skip.message,
      missingKeys: Array.isArray(missingKeys) ? (missingKeys as string[][]) : [],
    };
    await this.events.publish({ name: ACCOUNTING_EVENTS.automaticEntrySkipped, occurredAt: this.clock.now(), payload });
  }

  private toDay(value: string): string {
    if (DAY_ONLY.test(value)) return CalendarDay.parse(value, 'fecha');
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? CalendarDay.parse(value, 'fecha') : CalendarDay.inColombia(instant);
  }

  private posted(entry: JournalEntry): AutomaticPostingResult {
    return { status: 'posted', entryId: entry.id as number, displayNumber: entry.displayNumber as string };
  }

  private alreadyPosted(): AutomaticPostingResult {
    return { status: 'skipped', reason: 'ALREADY_POSTED' };
  }

  private skip(reason: string, message: string, details: Record<string, unknown>): ReportedSkip {
    return { status: 'skipped', reason, message, details };
  }
}
