import { Inject, Injectable } from '@nestjs/common';
import { UNIT_OF_WORK, type UnitOfWorkPort } from '../../../shared/application/ports/unit-of-work.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Account } from '../domain/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { STANDARD_PUC } from '../domain/standard-puc.js';

export interface SeedStandardPucOutput {
  /** Accounts actually inserted (bug 14: the legacy always answered 64). */
  inserted: number;
  /** Accounts that already existed and were left untouched. */
  skipped: number;
}

/**
 * Loads the simplified Colombian PUC for schools (legacy
 * `accounting/api/seed_puc.php`). Idempotent by code (RN-ACC-07): existing
 * accounts are never overwritten. Runs in a single transaction.
 */
@Injectable()
export class SeedStandardPucUseCase implements UseCase<void, SeedStandardPucOutput> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWorkPort,
  ) {}

  execute(): Promise<SeedStandardPucOutput> {
    return this.uow.runInTransaction(async () => {
      const byCode = new Map((await this.accounts.findAll()).map((account) => [account.code.toString(), account]));
      let inserted = 0;
      for (const seed of STANDARD_PUC) {
        if (byCode.has(seed.code)) continue;
        const parent = seed.parentCode ? (byCode.get(seed.parentCode) ?? null) : null;
        const account = Account.create({ ...seed, parent });
        await this.accounts.save(account);
        byCode.set(seed.code, account);
        inserted++;
      }
      return { inserted, skipped: STANDARD_PUC.length - inserted };
    });
  }
}
