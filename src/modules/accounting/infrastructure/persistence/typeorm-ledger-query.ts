import { Injectable } from '@nestjs/common';
import type { SelectQueryBuilder } from 'typeorm';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type {
  AccountMovementRow,
  LedgerCriteria,
  LedgerLineRow,
  LedgerQueryPort,
} from '../../application/ports/ledger-query.port.js';
import type { VoucherType } from '../../domain/voucher-type.js';
import { JournalEntryOrmEntity } from './journal-entry.orm-entity.js';
import { JournalLineOrmEntity } from './journal-line.orm-entity.js';
import { ThirdPartyOrmEntity } from './third-party.orm-entity.js';

interface RawLine {
  entryId: number;
  entryDate: string;
  entryType: VoucherType;
  entryNumber: string;
  entryDescription: string;
  accountId: number;
  thirdPartyId: number | null;
  thirdPartyName: string | null;
  description: string | null;
  debit: string;
  credit: string;
}

/**
 * SQL read model over posted lines. Every filter goes in the WHERE clause
 * (bug 2) and only `status = 'posted'` entries are considered.
 */
@Injectable()
export class TypeOrmLedgerQuery implements LedgerQueryPort {
  constructor(private readonly db: TenantDataSource) {}

  async movementsByAccount(criteria: LedgerCriteria): Promise<AccountMovementRow[]> {
    const rows: { accountId: number; debit: string; credit: string }[] = await (
      await this.base(criteria)
    )
      .select('l.account_id', 'accountId')
      .addSelect('SUM(l.debit)', 'debit')
      .addSelect('SUM(l.credit)', 'credit')
      .groupBy('l.account_id')
      .getRawMany();
    return rows.map((row) => ({
      accountId: Number(row.accountId),
      debit: Money.of(row.debit),
      credit: Money.of(row.credit),
    }));
  }

  async lines(criteria: LedgerCriteria): Promise<LedgerLineRow[]> {
    const rows: RawLine[] = await (
      await this.base(criteria)
    )
      .leftJoin(ThirdPartyOrmEntity, 't', 't.id = l.third_party_id')
      .select('e.id', 'entryId')
      .addSelect("to_char(e.entry_date, 'YYYY-MM-DD')", 'entryDate')
      .addSelect('e.entry_type', 'entryType')
      .addSelect('e.entry_number', 'entryNumber')
      .addSelect('e.description', 'entryDescription')
      .addSelect('l.account_id', 'accountId')
      .addSelect('l.third_party_id', 'thirdPartyId')
      .addSelect('t.name', 'thirdPartyName')
      .addSelect('l.description', 'description')
      .addSelect('l.debit', 'debit')
      .addSelect('l.credit', 'credit')
      .orderBy('e.entry_date', 'ASC')
      .addOrderBy('e.id', 'ASC')
      .addOrderBy('l.id', 'ASC')
      .getRawMany();
    return rows.map((row) => ({
      ...row,
      entryId: Number(row.entryId),
      accountId: Number(row.accountId),
      thirdPartyId: row.thirdPartyId === null ? null : Number(row.thirdPartyId),
      debit: Money.of(row.debit),
      credit: Money.of(row.credit),
    }));
  }

  async countPostedEntries(criteria: LedgerCriteria): Promise<number> {
    const row: { total: number } | undefined = await (
      await this.base(criteria)
    )
      .select('COUNT(DISTINCT e.id)::int', 'total')
      .getRawOne();
    return Number(row?.total ?? 0);
  }

  private async base(criteria: LedgerCriteria): Promise<SelectQueryBuilder<JournalLineOrmEntity>> {
    const query = (await this.db.manager())
      .createQueryBuilder(JournalLineOrmEntity, 'l')
      .innerJoin(JournalEntryOrmEntity, 'e', 'e.id = l.entry_id')
      .where("e.status = 'posted'");
    if (criteria.from) query.andWhere('e.entry_date >= :from', { from: criteria.from });
    if (criteria.to) query.andWhere('e.entry_date <= :to', { to: criteria.to });
    if (criteria.entryType) query.andWhere('e.entry_type = :entryType', { entryType: criteria.entryType });
    if (criteria.thirdPartyId !== undefined)
      query.andWhere('l.third_party_id = :thirdPartyId', { thirdPartyId: criteria.thirdPartyId });
    if (criteria.accountIds) {
      if (criteria.accountIds.length === 0) query.andWhere('1 = 0');
      else query.andWhere('l.account_id IN (:...accountIds)', { accountIds: criteria.accountIds });
    }
    return query;
  }
}
