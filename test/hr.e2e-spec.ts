import { createE2eApp, DIRECTOR, type E2eContext, uniqueSuffix } from './support/e2e-app.js';
import { DATE_ONLY, NEW_PASSWORD } from './support/fixtures.js';
import { asBuffer, expectStatus, isPdf } from './support/http.js';
import { uniqueDocument } from './support/students.js';

describe('hr (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let employeeId: number;
  let account: { email: string; temporaryPassword: string };
  const passport = `PA${uniqueDocument()}X`;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
  });
  afterAll(() => ctx?.close());

  it('registers an employee; dates round-trip as YYYY-MM-DD', async () => {
    const res = await ctx
      .api(director)
      .post('/api/hr/employees')
      .send({
        firstName: 'Ana María',
        lastName: `Pérez E2E ${uniqueSuffix()}`,
        documentType: 'pa',
        documentNumber: passport,
        birthDate: '1990-05-20',
        gender: 'F',
        employeeType: 'administrativo',
        position: 'Secretaria',
        hireDate: '2026-01-15',
        contractType: 'indefinido',
        baseSalary: 2_500_000,
        eps: 'Sura',
        pensionFund: 'Porvenir',
        arl: 'Sura',
        arlRiskClass: 1,
        email: `e2e.ana.${uniqueSuffix()}@demo.co`,
        createUserAccount: true,
      });
    expectStatus(res, 201);
    expect(res.body.account).toMatchObject({ created: true, temporaryPassword: expect.any(String) });
    account = res.body.account;
    const employee = res.body.employee ?? res.body;
    employeeId = employee.id;
    expect(employee.birthDate).toBe('1990-05-20');
    expect(employee.hireDate).toBe('2026-01-15');
    expect(employee.hireDate).toMatch(DATE_ONLY);
  });

  it('rejects the same document typed in lower case', async () => {
    const res = await ctx.api(director).post('/api/hr/employees').send({
      firstName: 'Duplicada',
      lastName: 'Mayúsculas',
      documentType: 'pa',
      documentNumber: passport.toLowerCase(),
      gender: 'F',
      employeeType: 'otro',
      contractType: 'fijo',
      baseSalary: 1_750_905,
    });
    expectStatus(res, 409);
  });

  let payslipId: number;

  it('runs the payroll (create → calculate → approve → pay) and renders the payslip PDF', async () => {
    const period = await ctx.api(director).post('/api/payroll/periods').send({
      name: 'Nómina octubre 2026',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      paymentDate: '2026-10-30',
      frequency: 'monthly',
    });
    expectStatus(period, 201);
    const periodId = period.body.id;
    expect(period.body).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31', paymentDate: '2026-10-30' });

    expectStatus(await ctx.api(director).post(`/api/payroll/periods/${periodId}/calculate`), 200, 201);
    expectStatus(await ctx.api(director).post(`/api/payroll/periods/${periodId}/approve`), 200, 201);
    const paid = await ctx.api(director).post(`/api/payroll/periods/${periodId}/pay`);
    expectStatus(paid, 200, 201);
    expect(paid.body.status).toBe('paid');

    const detail = await ctx.api(director).get(`/api/payroll/periods/${periodId}`);
    expectStatus(detail, 200);
    const payslips = detail.body.payslips ?? detail.body.payments ?? [];
    const mine = payslips.find((p: { employeeId: number }) => p.employeeId === employeeId);
    expect(mine).toBeDefined();
    expect(mine.netPay ?? mine.net ?? mine.totalNet).toBeGreaterThan(0);
    payslipId = mine.id;

    const pdf = await ctx.api(director).get(`/api/payroll/payslips/${payslipId}/document`).buffer(true).parse(asBuffer);
    expectStatus(pdf, 200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(isPdf(pdf.body)).toBe(true);

    const history = await ctx.api(director).get(`/api/hr/employees/${employeeId}/payslips`);
    expectStatus(history, 200);
  });

  it('the employee downloads their own payslip from the self-service portal', async () => {
    const token = await ctx.login(account.email, account.temporaryPassword);
    await ctx
      .api(token)
      .patch('/api/auth/password')
      .send({ currentPassword: account.temporaryPassword, newPassword: NEW_PASSWORD })
      .expect(204);
    const mine = await ctx.api(token).get('/api/me/employee/payslips');
    expectStatus(mine, 200);
    expect(mine.body.items.map((p: { paymentId: number }) => p.paymentId)).toContain(payslipId);
    const pdf = await ctx
      .api(token)
      .get(`/api/me/employee/payslips/${payslipId}/document`)
      .buffer(true)
      .parse(asBuffer);
    expectStatus(pdf, 200);
    expect(isPdf(pdf.body)).toBe(true);
    expectStatus(await ctx.api(token).get('/api/hr/employees'), 403);
  });

  it('issues an employment certificate verifiable publicly (code in any case)', async () => {
    const issued = await ctx
      .api(director)
      .post(`/api/hr/employees/${employeeId}/certificates/employment`)
      .send({ includeSalary: true, addressee: 'A quien pueda interesar' });
    expectStatus(issued, 201);
    const code: string = issued.body.code ?? issued.body.verificationCode;
    expect(code).toEqual(expect.any(String));

    const verified = await ctx.api().get(`/api/hr/documents/verify/${code}`);
    expectStatus(verified, 200);
    expect(verified.body).toMatchObject({ code, institutionName: expect.any(String) });
    expect(verified.body.employeeName).toContain('Ana María');
    expect(JSON.stringify(verified.body)).not.toContain('2500000');

    const lower = await ctx.api().get(`/api/hr/documents/verify/${encodeURIComponent(` ${code.toLowerCase()} `)}`);
    expectStatus(lower, 200);
    expect(lower.body.code).toBe(code);

    const copy = await ctx
      .api(director)
      .get(`/api/hr/documents/${code.toLowerCase()}/document`)
      .buffer(true)
      .parse(asBuffer);
    expectStatus(copy, 200);
    expect(isPdf(copy.body)).toBe(true);

    expectStatus(await ctx.api().get('/api/hr/documents/verify/NOEXISTE1'), 404);
  });

  it('income certificate of the year', async () => {
    expectStatus(await ctx.api(director).get(`/api/hr/employees/${employeeId}/income-certificate?year=2026`), 200);
  });
});
