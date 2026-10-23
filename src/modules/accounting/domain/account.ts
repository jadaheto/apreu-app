import { BusinessRuleViolationError } from '../../../shared/domain/domain-error.js';
import { Entity, type EntityId } from '../../../shared/domain/entity.js';
import { Guard } from '../../../shared/domain/guard.js';
import { AccountCode, type AccountLevel } from './account-code.js';
import { ACCOUNT_TYPES, natureOf, typeForCode, type AccountNature, type AccountType } from './account-type.js';

export interface AccountProps {
  code: AccountCode;
  name: string;
  type: AccountType;
  isTransactional: boolean;
  parentId: number | null;
  createdAt: Date | null;
}

export interface CreateAccountProps {
  code: string;
  name: string;
  /** Optional: derived from the first digit when omitted. */
  type?: AccountType;
  isTransactional: boolean;
  parent: Account | null;
}

/**
 * Account of the chart of accounts (`accounting_accounts`, legacy
 * `accounting/accounts.php`).
 *
 * Invariants on creation (not enforced by the legacy code, RN-ACC-02/03):
 * - The code is a valid PUC code and its class matches `type`.
 * - The parent is a summary account ("mayor") whose code is a prefix of the code,
 *   and both share the same type.
 * Only transactional accounts ("de movimiento") receive journal lines (RN-ACC-05).
 */
export class Account extends Entity<AccountProps> {
  private constructor(id: EntityId, props: AccountProps) {
    super(id, props);
  }

  static create(input: CreateAccountProps): Account {
    const code = AccountCode.create(input.code);
    const name = Account.validName(input.name);
    const expectedType = typeForCode(code.toString());
    const type = input.type ?? expectedType;
    Guard.oneOf(type, ACCOUNT_TYPES, 'tipo');
    if (type !== expectedType) {
      throw new BusinessRuleViolationError(
        `Una cuenta que inicia por "${code.toString().charAt(0)}" debe ser de tipo "${expectedType}".`,
        'ACCOUNT_TYPE_MISMATCH',
      );
    }
    if (input.parent) Account.assertValidParent(code, type, input.parent);
    return new Account(null, {
      code,
      name,
      type,
      isTransactional: input.isTransactional,
      parentId: input.parent?.id ?? null,
      createdAt: null,
    });
  }

  static restore(id: number, props: AccountProps): Account {
    return new Account(id, { ...props });
  }

  private static validName(raw: string): string {
    const name = raw?.trim();
    Guard.againstEmpty(name, 'nombre');
    Guard.againstMaxLength(name, 150, 'nombre');
    return name;
  }

  private static assertValidParent(code: AccountCode, type: AccountType, parent: Account): void {
    if (!parent.code.isAncestorOf(code)) {
      throw new BusinessRuleViolationError(
        `El código "${code.toString()}" debe iniciar con el código de la cuenta padre "${parent.code.toString()}".`,
        'INVALID_PARENT_PREFIX',
      );
    }
    if (parent.isTransactional) {
      throw new BusinessRuleViolationError(
        'La cuenta padre es de movimiento; sólo las cuentas mayores pueden tener subcuentas.',
        'PARENT_IS_TRANSACTIONAL',
      );
    }
    if (parent.type !== type) {
      throw new BusinessRuleViolationError(
        'La cuenta debe ser del mismo tipo que su cuenta padre.',
        'ACCOUNT_TYPE_MISMATCH',
      );
    }
  }

  get code(): AccountCode {
    return this.props.code;
  }
  get name(): string {
    return this.props.name;
  }
  get type(): AccountType {
    return this.props.type;
  }
  get nature(): AccountNature {
    return natureOf(this.props.type, this.props.code.toString());
  }
  get level(): AccountLevel {
    return this.props.code.level;
  }
  get isTransactional(): boolean {
    return this.props.isTransactional;
  }
  get parentId(): number | null {
    return this.props.parentId;
  }
  get createdAt(): Date | null {
    return this.props.createdAt;
  }

  rename(name: string): void {
    this.props.name = Account.validName(name);
  }

  /** Callers must check that the account has no movements/children first (see `UpdateAccountUseCase`). */
  changeTransactional(isTransactional: boolean): void {
    this.props.isTransactional = isTransactional;
  }
}
