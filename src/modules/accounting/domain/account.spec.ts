import { AccountCode } from './account-code.js';
import { natureOf, naturalBalance, typeForCode } from './account-type.js';
import { Account } from './account.js';

describe('AccountCode', () => {
  it.each([
    ['1', 1],
    ['11', 2],
    ['1105', 3],
    ['110505', 4],
    ['11050501', 5],
  ])('derives the PUC level of %s', (code, level) => {
    expect(AccountCode.create(code).level).toBe(level);
  });

  it.each(['', 'abc', '111', '11050', '1105055', '1'.repeat(21)])('rejects invalid code "%s"', (code) => {
    expect(() => AccountCode.create(code)).toThrow(expect.objectContaining({ code: 'INVALID_ACCOUNT_CODE' }));
  });

  it('detects ancestors by prefix and truncates to a level', () => {
    const code = AccountCode.create('110505');
    expect(AccountCode.create('1105').isAncestorOf(code)).toBe(true);
    expect(AccountCode.create('1110').isAncestorOf(code)).toBe(false);
    expect(code.isAncestorOf(code)).toBe(false);
    expect(code.truncateTo(3)).toBe('1105');
  });
});

describe('account type and nature', () => {
  it.each([
    ['1', 'activo', 'debito'],
    ['2', 'pasivo', 'credito'],
    ['3', 'patrimonio', 'credito'],
    ['4', 'ingreso', 'credito'],
    ['5', 'gasto', 'debito'],
    ['6', 'costo', 'debito'],
    ['8', 'orden', 'debito'],
    ['9', 'orden', 'credito'],
  ])('class %s is %s with %s nature', (code, type, nature) => {
    expect(typeForCode(code)).toBe(type);
    expect(natureOf(typeForCode(code), code)).toBe(nature);
  });

  it('computes balances according to nature', () => {
    expect(naturalBalance('debito', 500, 200)).toBe(300);
    expect(naturalBalance('credito', 500, 200)).toBe(-300);
  });
});

describe('Account', () => {
  const caja = () => {
    const account = Account.create({ code: '1105', name: 'Caja', isTransactional: false, parent: null });
    account.assignId(1);
    return account;
  };

  it('derives the type from the first digit', () => {
    const account = Account.create({ code: '110505', name: ' Caja General ', isTransactional: true, parent: caja() });
    expect(account).toMatchObject({ type: 'activo', nature: 'debito', name: 'Caja General', parentId: 1, level: 4 });
  });

  it('rejects a type inconsistent with the code class', () => {
    expect(() =>
      Account.create({ code: '4135', name: 'X', type: 'gasto', isTransactional: false, parent: null }),
    ).toThrow(expect.objectContaining({ code: 'ACCOUNT_TYPE_MISMATCH' }));
  });

  it('requires the parent code as prefix', () => {
    expect(() => Account.create({ code: '111005', name: 'X', isTransactional: true, parent: caja() })).toThrow(
      expect.objectContaining({ code: 'INVALID_PARENT_PREFIX' }),
    );
  });

  it('rejects movement accounts as parents', () => {
    const parent = Account.create({ code: '1305', name: 'Clientes', isTransactional: true, parent: null });
    parent.assignId(2);
    expect(() => Account.create({ code: '130505', name: 'X', isTransactional: true, parent })).toThrow(
      expect.objectContaining({ code: 'PARENT_IS_TRANSACTIONAL' }),
    );
  });

  it('validates the name on rename', () => {
    const account = caja();
    account.rename('Caja menor');
    expect(account.name).toBe('Caja menor');
    expect(() => account.rename(' ')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
  });
});
