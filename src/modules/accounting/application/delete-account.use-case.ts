import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { POSTING_RULE_REPOSITORY, type PostingRuleRepository } from '../domain/posting-rule.repository.js';

/**
 * Deletes an account (RN-ACC-06). Rejected when it has movements, sub-accounts
 * (bug 13: the legacy left children orphaned as roots) or is used by the
 * automatic posting parametrization.
 */
@Injectable()
export class DeleteAccountUseCase implements UseCase<number, void> {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository,
    @Inject(POSTING_RULE_REPOSITORY) private readonly rules: PostingRuleRepository,
  ) {}

  async execute(id: number): Promise<void> {
    if (!(await this.accounts.findById(id))) throw new NotFoundError('Cuenta contable', id);
    if (await this.accounts.hasMovements(id)) {
      throw new ConflictError('No se puede eliminar: la cuenta tiene movimientos.');
    }
    if (await this.accounts.hasChildren(id)) {
      throw new ConflictError('No se puede eliminar: la cuenta tiene subcuentas.');
    }
    if ((await this.rules.findAll()).some((rule) => rule.accountId === id)) {
      throw new ConflictError('No se puede eliminar: la cuenta está parametrizada para asientos automáticos.');
    }
    await this.accounts.delete(id);
  }
}
