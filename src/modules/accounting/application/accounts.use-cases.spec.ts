import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { FakeUnitOfWork } from '../../../shared/testing/fakes.js';
import { JournalEntry } from '../domain/journal-entry.js';
import { JournalLine } from '../domain/journal-line.js';
import { STANDARD_PUC } from '../domain/standard-puc.js';
import { createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { CreateAccountUseCase } from './create-account.use-case.js';
import { DeleteAccountUseCase } from './delete-account.use-case.js';
import { ListAccountsUseCase } from './list-accounts.use-case.js';
import { SeedStandardPucUseCase } from './seed-standard-puc.use-case.js';
import { UpdateAccountUseCase } from './update-account.use-case.js';

describe('chart of accounts use cases', () => {
  let f: AccountingFixture;
  let id: (code: string) => number;

  beforeEach(async () => {
    f = createAccountingFixture();
    id = await f.seedPuc();
  });

  describe('SeedStandardPucUseCase', () => {
    it('inserts only missing accounts in one transaction', async () => {
      const fresh = createAccountingFixture();
      const uow = new FakeUnitOfWork();
      const seed = new SeedStandardPucUseCase(fresh.accounts, uow);
      await expect(seed.execute()).resolves.toEqual({ inserted: STANDARD_PUC.length, skipped: 0 });
      await expect(seed.execute()).resolves.toEqual({ inserted: 0, skipped: STANDARD_PUC.length });
      expect(uow.transactions).toBe(2);
    });
  });

  describe('ListAccountsUseCase', () => {
    it('returns a flat filtered list or a tree', async () => {
      const list = new ListAccountsUseCase(f.accounts);
      const movement = await list.execute({ transactional: true, search: '1105' });
      expect(movement.map((a) => a.code)).toEqual(['110505']);
      const tree = await list.execute({ tree: true });
      expect(tree.map((a) => a.code)).toEqual(['1', '2', '3', '4', '5']);
      expect(tree[0].children?.[0]).toMatchObject({ code: '11', levelName: 'Grupo' });
    });
  });

  describe('CreateAccountUseCase', () => {
    const create = () => new CreateAccountUseCase(f.accounts);

    it('creates an account inferring its parent by prefix', async () => {
      const view = await create().execute({ code: '111015', name: 'Fiducia', isTransactional: true });
      expect(view).toMatchObject({ type: 'activo', level: 4, parentId: id('1110') });
      await expect(
        create().execute({ code: '11050502', name: 'Caja menor', isTransactional: true }),
      ).rejects.toMatchObject({
        code: 'PARENT_IS_TRANSACTIONAL',
      });
      await expect(
        create().execute({ code: '7', name: 'Costos', isTransactional: false, parentId: null }),
      ).resolves.toMatchObject({
        type: 'costo',
        parentId: null,
      });
    });

    it('rejects duplicated codes', async () => {
      await expect(create().execute({ code: '110505', name: 'Dup', isTransactional: true })).rejects.toMatchObject({
        code: 'CONFLICT',
      });
    });

    it('validates an explicit parent', async () => {
      await expect(
        create().execute({ code: '111015', name: 'Fiducia', isTransactional: true, parentId: id('1105') }),
      ).rejects.toMatchObject({ code: 'INVALID_PARENT_PREFIX' });
      await expect(
        create().execute({ code: '111015', name: 'X', isTransactional: true, parentId: 999 }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      const view = await create().execute({
        code: '111020',
        name: 'Fiducia',
        isTransactional: true,
        parentId: id('1110'),
      });
      expect(view.parentId).toBe(id('1110'));
    });
  });

  const postLineOn = async (accountId: number) => {
    const entry = JournalEntry.draft(
      {
        periodId: 1,
        date: '2026-03-01',
        type: 'NI',
        description: 'x',
        lines: [
          JournalLine.create({ accountId, debit: Money.of(1) }),
          JournalLine.create({ accountId: id('413502'), credit: Money.of(1) }),
        ],
      },
      1,
    );
    await f.entries.save(entry);
  };

  describe('UpdateAccountUseCase', () => {
    it('renames and changes classification when allowed', async () => {
      const update = new UpdateAccountUseCase(f.accounts);
      const view = await update.execute({ id: id('1305'), name: 'Deudores', isTransactional: false });
      expect(view).toMatchObject({ name: 'Deudores', isTransactional: false });
      await expect(update.execute({ id: id('1105'), isTransactional: true })).rejects.toMatchObject({
        code: 'ACCOUNT_HAS_CHILDREN',
      });
      await postLineOn(id('110505'));
      await expect(update.execute({ id: id('110505'), isTransactional: false })).rejects.toMatchObject({
        code: 'ACCOUNT_HAS_MOVEMENTS',
      });
      await expect(update.execute({ id: 999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('DeleteAccountUseCase', () => {
    it('deletes leaf accounts without movements or rules', async () => {
      const remove = new DeleteAccountUseCase(f.accounts, f.rules);
      await remove.execute(id('5315'));
      expect(await f.accounts.findById(id('5315'))).toBeNull();
    });

    it.each([
      ['with children', '1105', 'tiene subcuentas'],
      ['with movements', '110505', 'tiene movimientos'],
      ['used by posting rules', '5195', 'parametrizada'],
    ])('rejects accounts %s', async (_label, code, message) => {
      await postLineOn(id('110505'));
      await f.rules.save({ key: 'expense.debit.default', accountId: id('5195') });
      await expect(new DeleteAccountUseCase(f.accounts, f.rules).execute(id(code))).rejects.toThrow(message);
    });
  });
});
