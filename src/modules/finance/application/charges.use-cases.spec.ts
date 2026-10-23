import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import { FakeUnitOfWork, FixedClock } from '../../../shared/testing/fakes.js';
import { TuitionSchedule } from '../domain/tuition-schedule.js';
import { FakeFinanceSettings, FakeStudentDirectory, FakeStudentLinks } from '../testing/fakes.js';
import { aCharge, aConcept, aStudent, actorWith, financeUser } from '../testing/fixtures.js';
import {
  InMemoryBillingConceptRepository,
  InMemoryStudentChargeRepository,
  InMemoryTuitionScheduleRepository,
} from '../testing/in-memory-repositories.js';
import { CancelChargeUseCase } from './cancel-charge.use-case.js';
import { ChargeBatchPlanner } from './charge-batch-planner.js';
import { CreateIndividualChargeUseCase } from './create-individual-charge.use-case.js';
import { GenerateChargeBatchUseCase } from './generate-charge-batch.use-case.js';
import { GetChargeDocumentUseCase } from './get-charge-document.use-case.js';
import { PreviewChargeBatchUseCase } from './preview-charge-batch.use-case.js';
import { StudentAccessPolicy } from './student-access.policy.js';

describe('charge use cases', () => {
  let concepts: InMemoryBillingConceptRepository;
  let tuition: InMemoryTuitionScheduleRepository;
  let charges: InMemoryStudentChargeRepository;
  let students: FakeStudentDirectory;
  let planner: ChargeBatchPlanner;
  let uow: FakeUnitOfWork;
  const clock = new FixedClock();

  beforeEach(async () => {
    concepts = new InMemoryBillingConceptRepository();
    await concepts.save(aConcept({ name: 'Pensión', amount: 350000 }));
    tuition = new InMemoryTuitionScheduleRepository();
    await tuition.replace(TuitionSchedule.create(2026, [{ gradeId: 2, conceptId: 1, amount: 420000 }]));
    charges = new InMemoryStudentChargeRepository();
    students = new FakeStudentDirectory();
    students.add(aStudent({ id: 1, gradeId: 1 }));
    students.add(aStudent({ id: 2, gradeId: 2, fullName: 'Beto Ruiz', scholarshipPct: 50 }));
    students.add(aStudent({ id: 3, gradeId: 2, status: 'withdrawn' }));
    planner = new ChargeBatchPlanner(concepts, tuition, charges, students, new FakeFinanceSettings());
    uow = new FakeUnitOfWork();
  });

  const batch = { conceptId: 1, period: '2026-03', createdBy: 9 };

  describe('batch generation', () => {
    it('previews without saving, using the grade tuition', async () => {
      const summary = await new PreviewChargeBatchUseCase(planner).execute(batch);
      expect(summary).toMatchObject({
        conceptName: 'Pensión',
        dueDate: '2026-03-31',
        studentsCount: 2,
        alreadyCharged: 0,
        chargesCount: 2,
        totalNet: 770000,
        amounts: [
          { netAmount: 350000, count: 1 },
          { netAmount: 420000, count: 1 },
        ],
      });
      expect(charges.store.all()).toHaveLength(0);
    });

    it('generates in one transaction and is idempotent per period', async () => {
      const generate = new GenerateChargeBatchUseCase(planner, charges, uow);
      await generate.execute(batch);
      const again = await generate.execute({ ...batch, dueDate: '2026-04-10' });
      expect(again).toMatchObject({ chargesCount: 0, alreadyCharged: 2 });
      expect(charges.store.all()).toHaveLength(2);
      expect(charges.store.get(1)).toMatchObject({
        description: 'Pensión — Marzo 2026',
        academicYear: 2026,
        createdBy: 9,
      });
      expect(uow.transactions).toBe(2);
    });

    it('filters by grade and applies scholarships and custom amounts on request', async () => {
      const summary = await new GenerateChargeBatchUseCase(planner, charges, uow).execute({
        ...batch,
        gradeId: 2,
        customAmount: 100000,
        applyScholarship: true,
      });
      expect(summary).toMatchObject({ chargesCount: 1, totalNet: 50000 });
      expect(charges.store.get(1)?.amounts.discount.amount).toBe(50000);
    });

    it('rejects inactive concepts and empty universes', async () => {
      (await concepts.findById(1))?.deactivate();
      await expect(new PreviewChargeBatchUseCase(planner).execute(batch)).rejects.toMatchObject({
        code: 'CONCEPT_INACTIVE',
      });
      await expect(new PreviewChargeBatchUseCase(planner).execute({ ...batch, gradeId: 9 })).rejects.toMatchObject({
        code: 'NO_STUDENTS_TO_BILL',
      });
      await expect(new PreviewChargeBatchUseCase(planner).execute({ ...batch, conceptId: 99 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('individual charge', () => {
    const create = () => new CreateIndividualChargeUseCase(planner, students, charges, clock);

    it('creates a charge with custom description and due date', async () => {
      const view = await create().execute({
        ...batch,
        studentId: 3,
        dueDate: '2026-03-20',
        description: 'Certificado de estudio',
        customAmount: 25000,
      });
      expect(view).toMatchObject({
        studentId: 3,
        description: 'Certificado de estudio',
        dueDate: '2026-03-20',
        netAmount: 25000,
      });
    });

    it('rejects duplicates unless explicitly allowed', async () => {
      await create().execute({ ...batch, studentId: 1 });
      await expect(create().execute({ ...batch, studentId: 1 })).rejects.toBeInstanceOf(ConflictError);
      await expect(create().execute({ ...batch, studentId: 1, allowDuplicate: true })).resolves.toMatchObject({
        id: 2,
      });
    });

    it('fails for unknown students', async () => {
      await expect(create().execute({ ...batch, studentId: 404 })).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('cancel', () => {
    it('cancels a pending charge inside a locked transaction', async () => {
      await charges.save(aCharge());
      const view = await new CancelChargeUseCase(charges, uow, clock).execute({ chargeId: 1 });
      expect(view).toMatchObject({ status: 'cancelled', pendingAmount: 0 });
      expect(charges.lockRequests).toContain(true);
      await expect(new CancelChargeUseCase(charges, uow, clock).execute({ chargeId: 9 })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe('charge document', () => {
    let links: FakeStudentLinks;
    let useCase: GetChargeDocumentUseCase;

    beforeEach(async () => {
      const charge = aCharge({ net: 100000 });
      await charges.save(charge);
      charge.applyPayment(Money.of(100000));
      links = new FakeStudentLinks();
      useCase = new GetChargeDocumentUseCase(
        charges,
        concepts,
        students,
        new FakeFinanceSettings(),
        clock,
        new StudentAccessPolicy(links),
      );
    });

    it('returns taxes, payments and the paid stamp (bug B38)', async () => {
      const document = await useCase.execute({ chargeId: 1, actor: financeUser });
      expect(document).toMatchObject({
        documentNumber: '000001',
        isPaid: true,
        conceptName: 'Pensión',
        schoolName: 'Colegio Prueba',
      });
      expect(document.charge).toMatchObject({ paidAmount: 100000, pendingAmount: 0 });
    });

    it('lets guardians see only their students (bug S6)', async () => {
      const parent = actorWith(Role.PARENT, 50);
      await expect(useCase.execute({ chargeId: 1, actor: parent })).rejects.toMatchObject({ code: 'FORBIDDEN' });
      links.links.set(50, [1]);
      await expect(useCase.execute({ chargeId: 1, actor: parent })).resolves.toMatchObject({ isPaid: true });
    });
  });
});
