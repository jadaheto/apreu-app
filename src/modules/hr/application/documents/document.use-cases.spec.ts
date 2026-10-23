import { ForbiddenError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { Role } from '../../../../shared/domain/role.js';
import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import type { Employee } from '../../domain/employees/employee.js';
import { PayrollCalculator } from '../../domain/payroll/payroll-calculator.js';
import { PayrollParameters } from '../../domain/payroll/payroll-parameters.js';
import { PayrollPayment } from '../../domain/payroll/payroll-payment.js';
import { PayrollPeriod } from '../../domain/payroll/payroll-period.js';
import { actor, createHrTestContext, type HrTestContext } from '../../testing/hr-test-context.js';
import { GetIncomeCertificateUseCase } from './get-income-certificate.use-case.js';
import { GetPayslipUseCase } from './get-payslip.use-case.js';
import { IssueEmploymentCertificateUseCase } from './issue-employment-certificate.use-case.js';
import { ListPayslipsUseCase } from './list-payslips.use-case.js';
import { RenderIncomeCertificateUseCase } from './render-income-certificate.use-case.js';
import { RenderIssuedDocumentUseCase } from './render-issued-document.use-case.js';
import { RenderPayslipUseCase } from './render-payslip.use-case.js';
import { VerifyIssuedDocumentUseCase } from './verify-issued-document.use-case.js';

describe('document use cases', () => {
  let ctx: HrTestContext;
  let employee: Employee;
  let paymentId: number;
  let period: PayrollPeriod;
  const owner = () => actor(Role.TEACHER, employee.userId as number);
  const stranger = actor(Role.EMPLOYEE, 777);

  const getPayslip = () =>
    new GetPayslipUseCase(
      ctx.payments,
      ctx.periods,
      ctx.employees,
      ctx.institution,
      ctx.currentEmployee,
      ctx.parameters,
    );

  beforeEach(async () => {
    ctx = createHrTestContext();
    employee = await ctx.addEmployee({
      baseSalary: 1_750_905,
      bankName: 'Banco',
      bankAccount: '12345678',
      fixedLibranza: 100_000,
    });
    period = PayrollPeriod.create({
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      paymentDate: '2026-02-27',
      frequency: 'monthly',
      createdBy: 1,
    });
    await ctx.periods.save(period);
    const calculation = PayrollCalculator.calculate(
      employee,
      { frequency: 'monthly', contractDays: 30, absences: { paid: 0, incapacity: 0, unpaid: 0 } },
      [],
      PayrollParameters.legalDefault(2026) as PayrollParameters,
    );
    const payment = PayrollPayment.fromCalculation(period.id as number, employee.id as number, calculation);
    await ctx.payments.saveAll([payment]);
    paymentId = payment.id as number;
  });

  const release = () => {
    period.recordCalculation({ gross: Money.zero(), deductions: Money.zero(), net: Money.zero() }, 1, new Date());
    period.approve(2, new Date(), false);
  };

  describe('GetPayslipUseCase', () => {
    it('builds lines that add up to the totals, with rates and amount in words', async () => {
      const payslip = await getPayslip().execute({ actor: actor(Role.FINANCE), paymentId });
      expect(payslip.institution.name).toBe('Colegio Prueba');
      expect(payslip.employee.bank.maskedAccount).toBe('****5678');
      expect(payslip.deductions.map((l) => l.label)).toEqual(['Salud (4 %)', 'Pensión (4 %)', 'Libranza']);
      const sum = (lines: { amount: number }[]) => lines.reduce((t, l) => t + l.amount, 0);
      expect(sum(payslip.earnings)).toBe(payslip.grossTotal);
      expect(sum(payslip.deductions)).toBe(payslip.deductionsTotal);
      expect(payslip.netInWords).toMatch(/pesos m\/cte\.$/);
    });

    it('shows the owner only released payslips and hides them from others', async () => {
      await expect(getPayslip().execute({ actor: owner(), paymentId })).rejects.toBeInstanceOf(NotFoundError);
      release();
      await expect(getPayslip().execute({ actor: owner(), paymentId })).resolves.toMatchObject({ paymentId });
      await expect(getPayslip().execute({ actor: stranger, paymentId })).rejects.toBeInstanceOf(NotFoundError);
      await expect(getPayslip().execute({ actor: owner(), paymentId: 999 })).rejects.toBeInstanceOf(NotFoundError);
    });

    it('renders through the document renderer', async () => {
      const rendered = await new RenderPayslipUseCase(getPayslip(), ctx.renderer).execute({
        actor: actor(Role.HR),
        paymentId,
      });
      expect(JSON.parse(rendered.body as string)).toMatchObject({ paymentId });
    });
  });

  describe('ListPayslipsUseCase', () => {
    const list = (by: ReturnType<typeof actor>, employeeId?: number) =>
      new ListPayslipsUseCase(ctx.payments, ctx.currentEmployee).execute({
        actor: by,
        employeeId,
        page: { page: 1, limit: 10 },
      });

    it('lists every payslip for payroll viewers and only released ones for the employee', async () => {
      await expect(list(actor(Role.HR), employee.id as number)).resolves.toMatchObject({ total: 1 });
      await expect(list(owner())).resolves.toMatchObject({ total: 0 });
      release();
      await expect(list(owner())).resolves.toMatchObject({ total: 1 });
      await expect(list(owner(), 5)).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe('employment certificates', () => {
    const issue = (by: ReturnType<typeof actor>, employeeId?: number, includeSalary = true) =>
      new IssueEmploymentCertificateUseCase(
        ctx.documents,
        ctx.institution,
        ctx.random,
        ctx.clock,
        ctx.currentEmployee,
      ).execute({
        actor: by,
        employeeId,
        includeSalary,
        addressee: 'A quien interese',
      });

    it('issues, stores and renders a verifiable certificate', async () => {
      const issued = await issue(owner());
      expect(issued.content).toMatchObject({
        employeeName: 'Ana Pérez',
        documentLabel: 'cédula de ciudadanía',
        contractLabel: 'término indefinido',
        salary: 1_750_905,
        salaryInWords: 'un millón setecientos cincuenta mil novecientos cinco pesos m/cte.',
        issuedOn: '2026-03-15',
        currentlyEmployed: true,
      });

      const render = new RenderIssuedDocumentUseCase(ctx.documents, ctx.renderer, ctx.currentEmployee);
      await expect(render.execute({ actor: owner(), code: issued.verificationCode })).resolves.toMatchObject({
        fileName: 'certificate.json',
      });
      await expect(render.execute({ actor: stranger, code: issued.verificationCode })).rejects.toBeInstanceOf(
        NotFoundError,
      );

      const verification = await new VerifyIssuedDocumentUseCase(ctx.documents).execute(issued.verificationCode);
      expect(verification).toMatchObject({ employeeName: 'Ana Pérez', institutionName: 'Colegio Prueba' });
      expect(verification).not.toHaveProperty('salary');
      await expect(new VerifyIssuedDocumentUseCase(ctx.documents).execute('NOPE')).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it('verifies and renders a code typed in lower case or with spaces (ADR-0008)', async () => {
      const issued = await issue(owner());
      const typed = `  ${issued.verificationCode.toLowerCase()} `;
      await expect(new VerifyIssuedDocumentUseCase(ctx.documents).execute(typed)).resolves.toMatchObject({
        code: issued.verificationCode,
      });
      const render = new RenderIssuedDocumentUseCase(ctx.documents, ctx.renderer, ctx.currentEmployee);
      await expect(render.execute({ actor: owner(), code: typed })).resolves.toMatchObject({
        fileName: 'certificate.json',
      });
    });

    it('omits the salary on request and lets only HR issue for others', async () => {
      await expect(issue(owner(), undefined, false)).resolves.toMatchObject({
        content: { salary: null, salaryInWords: null },
      });
      await expect(issue(owner(), 99)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(issue(actor(Role.HR), employee.id as number)).resolves.toBeDefined();
    });
  });

  describe('GetIncomeCertificateUseCase', () => {
    it('sums the paid payslips of the year', async () => {
      release();
      period.markPaid(new Date());
      const [payment] = await ctx.payments.findByPeriod(period.id as number);
      payment.markPaid();
      const certificate = await new GetIncomeCertificateUseCase(ctx.payments, ctx.clock, ctx.currentEmployee).execute({
        actor: owner(),
        year: 2026,
      });
      expect(certificate).toMatchObject({
        payments: 1,
        grossPayments: 2_000_000,
        mandatoryContributions: { health: 70_036, pension: 70_036, total: 140_072 },
        withholding: 0,
      });
    });

    it('renders the summary with the institution and the issue date', async () => {
      const rendered = await new RenderIncomeCertificateUseCase(
        new GetIncomeCertificateUseCase(ctx.payments, ctx.clock, ctx.currentEmployee),
        ctx.institution,
        ctx.renderer,
        ctx.clock,
      ).execute({ actor: owner(), year: 2026 });
      expect(JSON.parse(rendered.body as string)).toMatchObject({
        institution: { name: 'Colegio Prueba' },
        certificate: { year: 2026, employee: { id: employee.id } },
        issuedOn: '2026-03-15',
      });
    });

    it('rejects future years', async () => {
      await expect(
        new GetIncomeCertificateUseCase(ctx.payments, ctx.clock, ctx.currentEmployee).execute({
          actor: owner(),
          year: 2027,
        }),
      ).rejects.toMatchObject({ code: 'INVALID_YEAR' });
    });
  });
});
