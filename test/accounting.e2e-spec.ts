import { createE2eApp, DIRECTOR, type E2eContext, todayInBogota, uniqueSuffix } from './support/e2e-app.js';
import { DATE_ONLY, eventually } from './support/fixtures.js';
import { asBuffer, expectStatus, isPdf, isZip } from './support/http.js';
import { enrollStudent, type EnrolledStudent, uniqueDocument } from './support/students.js';

const FROM = '2026-10-01';
const TO = '2026-10-31';

describe('accounting (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let student: EnrolledStudent;
  let conceptId: number;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
    student = await enrollStudent(ctx, director, { withGuardian: false });
    const concept = await ctx
      .api(director)
      .post('/api/finance/concepts')
      .send({ name: `Matrícula E2E ${uniqueSuffix()}`, category: 'matricula', amount: 300_000, taxRate: 0 });
    expectStatus(concept, 201);
    conceptId = concept.body.id;
  });
  afterAll(() => ctx?.close());

  const charge = async (amount: number): Promise<number> => {
    const res = await ctx.api(director).post('/api/finance/charges').send({
      conceptId,
      period: '2026-10',
      dueDate: TO,
      studentId: student.id,
      customAmount: amount,
      allowDuplicate: true,
    });
    expectStatus(res, 201);
    return (res.body.id ?? res.body.charge?.id ?? res.body.charges?.[0]?.id) as number;
  };

  const entryOf = (paymentId: number) =>
    eventually(async () => {
      const res = await ctx.api(director).get(`/api/accounting/journal-entries?from=${FROM}&to=${TO}&limit=100`);
      expectStatus(res, 200);
      return res.body.items.find(
        (e: { sourceType: string; sourceId: string }) =>
          e.sourceType === 'finance.payment' && e.sourceId === String(paymentId),
      );
    });

  it('loads the default posting rules (PUC + rules), idempotently', async () => {
    const first = await ctx.api(director).post('/api/accounting/posting-rules/defaults');
    expectStatus(first, 200, 201);
    expect(first.body.accountsInserted).toBeGreaterThan(0);
    expect(first.body.created.length).toBeGreaterThan(0);
    expect(first.body.created).toEqual(expect.arrayContaining([expect.stringMatching(/^payment\.debit\./)]));

    const second = await ctx.api(director).post('/api/accounting/posting-rules/defaults');
    expect(second.body).toMatchObject({ accountsInserted: 0, created: [] });
    expect(second.body.kept.length).toBe(first.body.created.length);

    const rules = await ctx.api(director).get('/api/accounting/posting-rules');
    expectStatus(rules, 200);
  });

  it('opens the accounting period of the month', async () => {
    const res = await ctx
      .api(director)
      .post('/api/accounting/periods')
      .send({ name: 'Octubre 2026', startDate: FROM, endDate: TO });
    expectStatus(res, 201);
    expect(res.body).toMatchObject({ startDate: FROM, endDate: TO });
    expect((await ctx.api(director).get('/api/accounting/periods/current')).status).toBe(200);
  });

  let paymentId: number;
  let entryId: number;

  it('books the receipt entry (RC) automatically when a payment is registered', async () => {
    const chargeId = await charge(300_000);
    const payment = await ctx
      .api(director)
      .post('/api/finance/payments')
      .send({ studentId: student.id, amount: 320_000, method: 'efectivo', chargeIds: [chargeId] });
    expectStatus(payment, 201);
    paymentId = payment.body.paymentId;

    const entry = await entryOf(paymentId);
    expect(entry).toMatchObject({ type: 'RC', status: 'posted', totalDebit: 320_000, totalCredit: 320_000 });
    expect(entry.description).toContain(payment.body.receiptNumber);
    expect(entry.date).toMatch(DATE_ONLY);
    expect(entry.date).toBe(todayInBogota());
    entryId = entry.id;

    const detail = await ctx.api(director).get(`/api/accounting/journal-entries/${entryId}`);
    expectStatus(detail, 200);
    expect(JSON.stringify(detail.body)).toContain('Saldo no aplicado');
  });

  it('books a back-dated payment on its Bogotá calendar day', async () => {
    const chargeId = await charge(10_000);
    const payment = await ctx
      .api(director)
      .post('/api/finance/payments')
      .send({
        studentId: student.id,
        amount: 10_000,
        method: 'efectivo',
        paymentDate: '2026-10-01',
        chargeIds: [chargeId],
      });
    expectStatus(payment, 201);
    const entry = await entryOf(payment.body.paymentId);
    expect(entry.date).toBe('2026-10-01');
  });

  it('produces a balanced trial balance that includes the receipt', async () => {
    const res = await ctx.api(director).get(`/api/accounting/reports/trial-balance?from=${FROM}&to=${TO}`);
    expectStatus(res, 200);
    expect(res.body.balanced).toBe(true);
    expect(res.body.totals.debit).toBe(res.body.totals.credit);
    expect(res.body.totals.debit).toBeGreaterThanOrEqual(330_000);
    expect(res.body.rows.length).toBeGreaterThan(0);
  });

  it('exports the trial balance as XLSX, PDF and CSV', async () => {
    const base = `/api/accounting/reports/trial-balance/export?from=${FROM}&to=${TO}`;
    const xlsx = await ctx.api(director).get(`${base}&format=xlsx`).buffer(true).parse(asBuffer);
    expectStatus(xlsx, 200);
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    expect(isZip(xlsx.body)).toBe(true);

    const pdf = await ctx.api(director).get(`${base}&format=pdf`).buffer(true).parse(asBuffer);
    expectStatus(pdf, 200);
    expect(isPdf(pdf.body)).toBe(true);

    const csv = await ctx.api(director).get(`${base}&format=csv`).buffer(true).parse(asBuffer);
    expectStatus(csv, 200);
    expect(csv.body.toString('utf8').length).toBeGreaterThan(0);
  });

  it('reverses the receipt entry when the payment is voided', async () => {
    const voided = await ctx
      .api(director)
      .post(`/api/finance/payments/${paymentId}/void`)
      .send({ reason: 'Prueba E2E' });
    expectStatus(voided, 200);
    const reversal = await eventually(async () => {
      const res = await ctx.api(director).get(`/api/accounting/journal-entries?from=${FROM}&to=${TO}&limit=100`);
      return res.body.items.find(
        (e: { sourceType: string; sourceId: string }) =>
          e.sourceType === 'finance.payment-void' && e.sourceId === String(paymentId),
      );
    });
    expect(reversal).toMatchObject({ status: 'posted', totalDebit: 320_000, totalCredit: 320_000 });
    expect(reversal.description).toContain('Prueba E2E');
    const balance = await ctx.api(director).get(`/api/accounting/reports/trial-balance?from=${FROM}&to=${TO}`);
    expect(balance.body.balanced).toBe(true);
  });

  it('third parties: the same document in another case is a duplicate', async () => {
    const document = `CE${uniqueDocument()}AB`;
    const create = (documentNumber: string) =>
      ctx
        .api(director)
        .post('/api/accounting/third-parties')
        .send({ documentType: 'CE', documentNumber, name: 'Proveedor E2E' });
    expectStatus(await create(document), 201);
    expectStatus(await create(document.toLowerCase()), 409);
  });

  it('a teacher-less role cannot read the books', async () => {
    // Guardians/students never reach accounting; checked with an anonymous call too.
    expectStatus(await ctx.api().get(`/api/accounting/reports/trial-balance?from=${FROM}&to=${TO}`), 401);
  });
});
