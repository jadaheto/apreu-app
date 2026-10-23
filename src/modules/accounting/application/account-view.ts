import { ACCOUNT_LEVEL_NAMES, type AccountLevel } from '../domain/account-code.js';
import type { AccountNature, AccountType } from '../domain/account-type.js';
import type { Account } from '../domain/account.js';

/** Read model of an account of the chart of accounts. */
export interface AccountView {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  nature: AccountNature;
  level: AccountLevel;
  levelName: string;
  isTransactional: boolean;
  parentId: number | null;
  children?: AccountView[];
}

export const toAccountView = (account: Account): AccountView => ({
  id: account.id as number,
  code: account.code.toString(),
  name: account.name,
  type: account.type,
  nature: account.nature,
  level: account.level,
  levelName: ACCOUNT_LEVEL_NAMES[account.level],
  isTransactional: account.isTransactional,
  parentId: account.parentId,
});
