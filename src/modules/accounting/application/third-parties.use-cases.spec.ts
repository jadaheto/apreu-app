import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { JournalEntry } from '../domain/journal-entry.js';
import { JournalLine } from '../domain/journal-line.js';
import { createAccountingFixture, type AccountingFixture } from '../testing/accounting-fixture.js';
import { ChangeThirdPartyStatusUseCase } from './change-third-party-status.use-case.js';
import { CreateThirdPartyUseCase } from './create-third-party.use-case.js';
import { DeleteThirdPartyUseCase } from './delete-third-party.use-case.js';
import { ListThirdPartiesUseCase } from './list-third-parties.use-case.js';
import { UpdateThirdPartyUseCase } from './update-third-party.use-case.js';

describe('third party use cases', () => {
  let f: AccountingFixture;
  const supplier = { documentType: 'NIT' as const, documentNumber: '890903938', name: 'Proveedor S.A.S.' };

  beforeEach(() => {
    f = createAccountingFixture();
  });

  it('creates a third party with computed DV and rejects duplicates', async () => {
    const create = new CreateThirdPartyUseCase(f.thirdParties);
    await expect(create.execute(supplier)).resolves.toMatchObject({ document: '890903938-8', isActive: true });
    await expect(create.execute(supplier)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('lists, updates and changes status', async () => {
    const created = await new CreateThirdPartyUseCase(f.thirdParties).execute(supplier);
    const other = await new CreateThirdPartyUseCase(f.thirdParties).execute({
      ...supplier,
      documentNumber: '800197268',
      name: 'DIAN',
    });
    const list = await new ListThirdPartiesUseCase(f.thirdParties).execute({
      search: 'prov',
      page: { page: 1, limit: 10 },
    });
    expect(list.items.map((t) => t.id)).toEqual([created.id]);

    const update = new UpdateThirdPartyUseCase(f.thirdParties);
    await expect(
      update.execute({ id: created.id, ...supplier, name: 'Nuevo nombre', city: 'Bogotá' }),
    ).resolves.toMatchObject({
      name: 'Nuevo nombre',
      city: 'Bogotá',
    });
    await expect(update.execute({ id: created.id, ...supplier, documentNumber: '800197268' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    await expect(update.execute({ id: 99, ...supplier })).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const status = new ChangeThirdPartyStatusUseCase(f.thirdParties);
    await expect(status.execute({ id: other.id, active: false })).resolves.toMatchObject({ isActive: false });
    await expect(status.execute({ id: other.id, active: true })).resolves.toMatchObject({ isActive: true });
    await expect(status.execute({ id: 99, active: true })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletes only third parties without movements', async () => {
    const id = await f.seedPuc();
    const created = await new CreateThirdPartyUseCase(f.thirdParties).execute(supplier);
    const remove = new DeleteThirdPartyUseCase(f.thirdParties);
    await f.entries.save(
      JournalEntry.draft(
        {
          periodId: 1,
          date: '2026-03-01',
          type: 'CE',
          description: 'Compra',
          lines: [
            JournalLine.create({ accountId: id('5135'), thirdPartyId: created.id, debit: Money.of(10) }),
            JournalLine.create({ accountId: id('110505'), credit: Money.of(10) }),
          ],
        },
        1,
      ),
    );
    await expect(remove.execute(created.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    const free = await new CreateThirdPartyUseCase(f.thirdParties).execute({
      ...supplier,
      documentNumber: '800197268',
    });
    await remove.execute(free.id);
    expect(await f.thirdParties.findById(free.id)).toBeNull();
    await expect(remove.execute(free.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
