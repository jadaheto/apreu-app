import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { AccountCode } from '../domain/account-code.js';
import type { AccountType } from '../domain/account-type.js';
import { Account } from '../domain/account.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { toAccountView, type AccountView } from './account-view.js';

export interface CreateAccountInput {
  code: string;
  name: string;
  type?: AccountType;
  isTransactional: boolean;
  /** When omitted the parent is inferred: the existing account with the longest code that prefixes the new one. */
  parentId?: number | null;
}

/**
 * Creates an account of the chart of accounts (legacy `accounts.php`
 * `action=create`, which always failed with HTTP 500 because of the
 * non-existent `strtrim()` — bug 1). Validates PUC code, type and parent
 * (bug 13) and rejects duplicated codes with a clear message.
 */
@Injectable()
export class CreateAccountUseCase implements UseCase<CreateAccountInput, AccountView> {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async execute(input: CreateAccountInput): Promise<AccountView> {
    const code = AccountCode.create(input.code);
    if (await this.accounts.findByCode(code.toString())) {
      throw new ConflictError(`Ya existe una cuenta con el código ${code.toString()}.`, { code: code.toString() });
    }
    const parent = await this.resolveParent(code, input.parentId);
    const account = Account.create({ ...input, code: code.toString(), parent });
    await this.accounts.save(account);
    return toAccountView(account);
  }

  private async resolveParent(code: AccountCode, parentId: number | null | undefined): Promise<Account | null> {
    if (parentId) {
      const parent = await this.accounts.findById(parentId);
      if (!parent) throw new NotFoundError('Cuenta padre', parentId);
      return parent;
    }
    if (parentId === null) return null;
    const ancestors = (await this.accounts.findAll()).filter((account) => account.code.isAncestorOf(code));
    return ancestors.sort((a, b) => b.code.toString().length - a.code.toString().length)[0] ?? null;
  }
}
