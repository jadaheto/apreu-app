import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { FakeUnitOfWork } from '../../../shared/testing/fakes.js';
import { FakeFinanceSettings, FakeGradeCatalog } from '../testing/fakes.js';
import { aConcept } from '../testing/fixtures.js';
import {
  InMemoryBillingConceptRepository,
  InMemoryTuitionScheduleRepository,
} from '../testing/in-memory-repositories.js';
import { CreateBillingConceptUseCase } from './create-billing-concept.use-case.js';
import { GetTuitionScheduleUseCase } from './get-tuition-schedule.use-case.js';
import { ListBillingConceptsUseCase } from './list-billing-concepts.use-case.js';
import { SaveTuitionScheduleUseCase } from './save-tuition-schedule.use-case.js';
import { SetBillingConceptActiveUseCase } from './set-billing-concept-active.use-case.js';
import { UpdateBillingConceptUseCase } from './update-billing-concept.use-case.js';

describe('billing concept use cases', () => {
  let concepts: InMemoryBillingConceptRepository;

  beforeEach(() => {
    concepts = new InMemoryBillingConceptRepository();
  });

  it('creates, updates, toggles and lists concepts', async () => {
    const created = await new CreateBillingConceptUseCase(concepts).execute({ name: 'Pensión', amount: 350000 });
    expect(created).toMatchObject({ id: 1, name: 'Pensión', amount: 350000, taxRate: 0, isActive: true });

    const updated = await new UpdateBillingConceptUseCase(concepts).execute({
      id: 1,
      name: 'Transporte',
      amount: 200000,
      taxRate: 19,
    });
    expect(updated).toMatchObject({ name: 'Transporte', taxRate: 19 });

    await new SetBillingConceptActiveUseCase(concepts).execute({ id: 1, active: false });
    const list = new ListBillingConceptsUseCase(concepts);
    await expect(list.execute({ active: true })).resolves.toEqual([]);
    await expect(list.execute({})).resolves.toHaveLength(1);

    await new SetBillingConceptActiveUseCase(concepts).execute({ id: 1, active: true });
    await expect(list.execute({ active: true })).resolves.toHaveLength(1);
  });

  it('fails for unknown concepts', async () => {
    await expect(
      new UpdateBillingConceptUseCase(concepts).execute({ id: 9, name: 'X', amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(new SetBillingConceptActiveUseCase(concepts).execute({ id: 9, active: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('tuition schedule use cases', () => {
  let concepts: InMemoryBillingConceptRepository;
  let schedules: InMemoryTuitionScheduleRepository;
  let uow: FakeUnitOfWork;
  let save: SaveTuitionScheduleUseCase;

  beforeEach(async () => {
    concepts = new InMemoryBillingConceptRepository();
    await concepts.save(aConcept());
    schedules = new InMemoryTuitionScheduleRepository();
    uow = new FakeUnitOfWork();
    save = new SaveTuitionScheduleUseCase(schedules, new FakeGradeCatalog([1, 2]), concepts, uow);
  });

  it('replaces the rates of the year inside a transaction', async () => {
    const view = await save.execute({
      academicYear: 2026,
      rates: [
        { gradeId: 1, conceptId: 1, amount: 400000 },
        { gradeId: 2, conceptId: null, amount: 300000 },
      ],
    });
    expect(view.rates).toHaveLength(2);
    expect(uow.transactions).toBe(1);
    const current = await new GetTuitionScheduleUseCase(schedules, new FakeFinanceSettings()).execute({});
    expect(current).toEqual(view);
  });

  it('rejects unknown grades and concepts', async () => {
    await expect(
      save.execute({ academicYear: 2026, rates: [{ gradeId: 5, conceptId: null, amount: 1 }] }),
    ).rejects.toMatchObject({
      code: 'UNKNOWN_GRADE',
      details: { gradeIds: [5] },
    });
    await expect(
      save.execute({ academicYear: 2026, rates: [{ gradeId: 1, conceptId: 8, amount: 1 }] }),
    ).rejects.toMatchObject({
      code: 'UNKNOWN_CONCEPT',
    });
    expect(uow.transactions).toBe(0);
  });

  it('reads another year on demand', async () => {
    const view = await new GetTuitionScheduleUseCase(schedules, new FakeFinanceSettings()).execute({ year: 2025 });
    expect(view).toEqual({ academicYear: 2025, rates: [] });
  });
});
