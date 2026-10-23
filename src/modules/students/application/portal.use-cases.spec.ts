import { ForbiddenError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { Incident } from '../domain/incident.js';
import { actorOf, createStudentsKit, type StudentsKit } from '../testing/students-test-kit.js';
import { GetPortalDashboardUseCase } from './get-portal-dashboard.use-case.js';
import { GetStudentFinancialSummaryUseCase } from './get-student-financial-summary.use-case.js';
import { ResolvePortalContextUseCase } from './resolve-portal-context.use-case.js';

describe('portal use cases', () => {
  let kit: StudentsKit;
  beforeEach(() => {
    kit = createStudentsKit();
  });

  describe('ResolvePortalContextUseCase', () => {
    it('returns the active children of a guardian (bug B14)', async () => {
      const guardian = await kit.addGuardian();
      guardian.linkUser(90);
      await kit.addStudent({ firstName: 'Beto' }, { guardianId: guardian.id });
      const withdrawn = await kit.addStudent({ firstName: 'Ana' }, { guardianId: guardian.id });
      withdrawn.changeStatus('withdrawn');
      await kit.addStudent({ firstName: 'Carla' }, { guardianId: guardian.id });

      const context = await new ResolvePortalContextUseCase(kit.students, kit.guardians, kit.studentViews).execute(
        actorOf(90, Role.PARENT),
      );
      expect(context.role).toBe(Role.PARENT);
      expect(context.students.map((s) => s.firstName)).toEqual(['Beto', 'Carla']);
    });

    it('returns the student linked to the user, or nothing when not linked', async () => {
      const student = await kit.addStudent();
      student.linkUser(91);
      const useCase = new ResolvePortalContextUseCase(kit.students, kit.guardians, kit.studentViews);
      await expect(useCase.execute(actorOf(91, Role.STUDENT))).resolves.toMatchObject({
        students: [{ id: student.id }],
      });
      await expect(useCase.execute(actorOf(92, Role.STUDENT))).resolves.toMatchObject({ students: [] });
      await expect(useCase.execute(actorOf(93, Role.PARENT))).resolves.toMatchObject({ students: [] });
      await expect(useCase.execute(actorOf(1, Role.SUPERADMIN))).resolves.toMatchObject({ students: [] });
    });
  });

  describe('GetPortalDashboardUseCase', () => {
    const dashboard = (kit: StudentsKit) =>
      new GetPortalDashboardUseCase(
        kit.access,
        kit.studentViews,
        kit.finance,
        kit.performance,
        kit.incidents,
        kit.settings,
        kit.clock,
      );

    it('aggregates balance, performance (rule 21) and recent incidents', async () => {
      const student = await kit.addStudent();
      student.linkUser(95);
      kit.finance.summaryResult = {
        charged: 300,
        paid: 100,
        balance: 200,
        overdueCount: 2,
      };
      kit.performance.result = { average: 4.26, recordCount: 8 };
      for (let i = 1; i <= 6; i++) {
        await kit.incidents.save(
          Incident.open({
            studentId: student.id,
            requestedBy: 95,
            title: `I${i}`,
            openedAt: kit.clock.now(),
          }),
        );
      }

      const view = await dashboard(kit).execute({
        actor: actorOf(95, Role.STUDENT),
        studentId: student.id as number,
      });

      expect(view.finance.balance).toBe(200);
      expect(view.performance).toEqual({
        academicYear: 2026,
        average: 4.3,
        percentage: 86,
        recordCount: 8,
      });
      expect(view.recentIncidents.map((i) => i.title)).toEqual(['I6', 'I5', 'I4', 'I3', 'I2']);
      expect(kit.finance.calls[0]).toEqual({
        method: 'summary',
        args: [student.id, '2026-03-15'],
      });
    });

    it('reports no average without grades and rejects foreign students', async () => {
      const student = await kit.addStudent();
      student.linkUser(96);
      const view = await dashboard(kit).execute({
        actor: actorOf(96, Role.STUDENT),
        studentId: student.id as number,
      });
      expect(view.performance).toMatchObject({
        average: null,
        percentage: null,
      });
      await expect(
        dashboard(kit).execute({
          actor: actorOf(97, Role.STUDENT),
          studentId: student.id as number,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('GetStudentFinancialSummaryUseCase', () => {
    it('returns totals, pending charges and payments to finance staff and owners', async () => {
      const student = await kit.addStudent();
      student.linkUser(98);
      kit.finance.pending = [
        {
          chargeId: 1,
          concept: 'Pensión',
          category: 'pension',
          description: 'Marzo',
          dueDate: '2026-03-05',
          netAmount: 100,
          applied: 0,
          pending: 100,
          status: 'pending',
          isOverdue: true,
        },
      ];
      const useCase = new GetStudentFinancialSummaryUseCase(kit.access, kit.finance, kit.clock);

      const view = await useCase.execute({
        actor: actorOf(4, Role.FINANCE),
        studentId: student.id as number,
      });
      expect(view.pendingCharges).toHaveLength(1);
      expect(kit.finance.calls).toContainEqual({
        method: 'payments',
        args: [student.id, 50],
      });
      await expect(
        useCase.execute({
          actor: actorOf(98, Role.STUDENT),
          studentId: student.id as number,
        }),
      ).resolves.toBeDefined();
      await expect(
        useCase.execute({
          actor: actorOf(5, Role.HR),
          studentId: student.id as number,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
