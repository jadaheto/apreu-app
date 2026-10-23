import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { toAccountView, type AccountView } from './account-view.js';

export interface UpdateAccountInput {
  id: number;
  name?: string;
  isTransactional?: boolean;
}

/**
 * Renames an account and/or changes whether it receives movements (the
 * legacy had no edition). The classification can only change when the
 * account has no movements; an account with sub-accounts cannot become a
 * movement account.
 */
@Injectable()
export class UpdateAccountUseCase implements UseCase<UpdateAccountInput, AccountView> {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async execute(input: UpdateAccountInput): Promise<AccountView> {
    const account = await this.accounts.findById(input.id);
    if (!account) throw new NotFoundError('Cuenta contable', input.id);
    if (input.name !== undefined) account.rename(input.name);
    if (input.isTransactional !== undefined && input.isTransactional !== account.isTransactional) {
      if (await this.accounts.hasMovements(input.id)) {
        throw new BusinessRuleViolationError(
          'No se puede cambiar la clasificación de una cuenta con movimientos.',
          'ACCOUNT_HAS_MOVEMENTS',
        );
      }
      if (input.isTransactional && (await this.accounts.hasChildren(input.id))) {
        throw new BusinessRuleViolationError(
          'Una cuenta con subcuentas no puede ser de movimiento.',
          'ACCOUNT_HAS_CHILDREN',
        );
      }
      account.changeTransactional(input.isTransactional);
    }
    await this.accounts.save(account);
    return toAccountView(account);
  }
}
