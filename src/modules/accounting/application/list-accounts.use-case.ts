import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ACCOUNT_REPOSITORY, type AccountRepository } from '../domain/account.repository.js';
import { toAccountView, type AccountView } from './account-view.js';

export interface ListAccountsInput {
  /** Return the PUC as a tree (roots with nested `children`). */
  tree?: boolean;
  /** Only movement (`true`) or summary (`false`) accounts; flat list only. */
  transactional?: boolean;
  /** Matches code prefix or name. */
  search?: string;
}

/**
 * Lists the chart of accounts ordered by code, flat or as a tree
 * (legacy `accounting/accounts.php`). Accounts whose parent no longer exists
 * are treated as roots.
 */
@Injectable()
export class ListAccountsUseCase implements UseCase<ListAccountsInput, AccountView[]> {
  constructor(@Inject(ACCOUNT_REPOSITORY) private readonly accounts: AccountRepository) {}

  async execute(input: ListAccountsInput): Promise<AccountView[]> {
    const views = (await this.accounts.findAll()).map(toAccountView);
    if (input.tree) return this.buildTree(views);
    const term = input.search?.trim().toLowerCase();
    return views
      .filter((view) => input.transactional === undefined || view.isTransactional === input.transactional)
      .filter((view) => !term || view.code.startsWith(term) || view.name.toLowerCase().includes(term));
  }

  private buildTree(views: AccountView[]): AccountView[] {
    const byId = new Map(views.map((view) => [view.id, { ...view, children: [] as AccountView[] }]));
    const roots: AccountView[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId === null ? undefined : byId.get(node.parentId);
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }
}
