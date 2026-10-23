import { createE2eApp, DIRECTOR, type E2eContext, todayInBogota, uniqueSuffix } from './support/e2e-app.js';
import { withTenantDb } from './support/e2e-databases.js';
import { bogotaDateOf, DATE_ONLY, NEW_PASSWORD } from './support/fixtures.js';
import { expectStatus } from './support/http.js';
import { enrollStudent, type EnrolledStudent } from './support/students.js';

const PERIOD = '2026-09';
const DUE_DATE = '2026-09-30'; // already overdue (cartera)
const FEE = 200_000;

describe('finance (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let conceptId: number;
  let family: EnrolledStudent;
  const others: EnrolledStudent[] = [];
  const chargeOf = new Map<number, number>();

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
    family = await enrollStudent(ctx, director, { firstName: 'Familia', portal: true });
    for (let i = 0; i < 6; i++) others.push(await enrollStudent(ctx, director, { withGuardian: false }));
  });
  afterAll(() => ctx?.close());

  it('creates a billing concept', async () => {
    const res = await ctx
      .api(director)
      .post('/api/finance/concepts')
      .send({ name: `Pensión E2E ${uniqueSuffix()}`, category: 'pension', amount: FEE, taxRate: 0 });
    expectStatus(res, 201);
    conceptId = res.body.id;
  });

  it('previews and generates the monthly charges for every active student, idempotently', async () => {
    const batch = { conceptId, period: PERIOD, dueDate: DUE_DATE, gradeId: 1 };
    const preview = await ctx.api(director).post('/api/finance/charges/batch/preview').send(batch);
    expectStatus(preview, 200);
    expect(preview.body.chargesCount).toBeGreaterThanOrEqual(7);

    const generated = await ctx.api(director).post('/api/finance/charges/batch').send(batch);
    expectStatus(generated, 201, 200);
    expect(generated.body).toMatchObject({ chargesCount: preview.body.chargesCount, dueDate: DUE_DATE });
    expect(generated.body.totalNet).toBe(FEE * preview.body.chargesCount);

    const again = await ctx.api(director).post('/api/finance/charges/batch').send(batch);
    expect(again.body.chargesCount).toBe(0);
    expect(again.body.alreadyCharged).toBe(preview.body.chargesCount);

    for (const student of [family, ...others]) {
      const list = await ctx.api(director).get(`/api/finance/charges?studentId=${student.id}&conceptId=${conceptId}`);
      expectStatus(list, 200);
      expect(list.body.items).toHaveLength(1);
      const charge = list.body.items[0];
      expect(charge).toMatchObject({ status: 'pending', pendingAmount: FEE, dueDate: DUE_DATE, period: PERIOD });
      expect(charge.dueDate).toMatch(DATE_ONLY);
      chargeOf.set(student.id, charge.id);
    }
  });

  let receipt: string;
  let paymentId: number;

  it('registers a payment applied to the charge and issues a receipt', async () => {
    const res = await ctx
      .api(director)
      .post('/api/finance/payments')
      .send({ studentId: family.id, amount: FEE + 5_000, method: 'efectivo', chargeIds: [chargeOf.get(family.id)] });
    expectStatus(res, 201);
    expect(res.body.receiptNumber).toMatch(/^[A-Z]+-2026-\d{6}$/);
    expect(res.body).toMatchObject({
      amount: FEE + 5_000,
      appliedAmount: FEE,
      unappliedAmount: 5_000,
      creditBalance: 5_000,
    });
    expect(res.body.applications).toEqual([
      expect.objectContaining({ chargeId: chargeOf.get(family.id), chargeStatus: 'paid', chargePending: 0 }),
    ]);
    // paid_at (timestamptz) is "now" and today in Bogotá.
    expect(Math.abs(Date.parse(res.body.paidAt) - Date.now())).toBeLessThan(60_000);
    expect(bogotaDateOf(res.body.paidAt)).toBe(todayInBogota());
    receipt = res.body.receiptNumber;
    paymentId = res.body.paymentId;

    const stored = await withTenantDb((db) =>
      db.query("SELECT to_char(payment_date, 'YYYY-MM-DD') AS local_day FROM payments WHERE id = $1", [paymentId]),
    );
    expect(stored.rows[0].local_day).toBe(todayInBogota()); // session TimeZone = America/Bogota
  });

  it('a back-dated payment keeps its Bogotá calendar day', async () => {
    const res = await ctx
      .api(director)
      .post('/api/finance/payments')
      .send({
        studentId: others[5].id,
        amount: 1_000,
        method: 'efectivo',
        paymentDate: '2026-10-01',
        chargeIds: [chargeOf.get(others[5].id)],
      });
    expectStatus(res, 201);
    expect(bogotaDateOf(res.body.paidAt)).toBe('2026-10-01');
    const stored = await withTenantDb((db) =>
      db.query('SELECT payment_date::date::text AS day FROM payments WHERE id = $1', [res.body.paymentId]),
    );
    expect(stored.rows[0].day).toBe('2026-10-01');
    const future = await ctx
      .api(director)
      .post('/api/finance/payments')
      .send({ studentId: others[5].id, amount: 1_000, method: 'efectivo', paymentDate: '2099-01-01' });
    expectStatus(future, 422);
    receiptsBefore = Number(res.body.receiptNumber.slice(-6));
  });

  let receiptsBefore = 0;

  it('finds the receipt by number, also typed in lower case', async () => {
    const res = await ctx.api(director).get(`/api/finance/receipts/${receipt}`);
    expectStatus(res, 200);
    expect(JSON.stringify(res.body)).toContain(receipt);
    expectStatus(await ctx.api(director).get(`/api/finance/receipts/${receipt.toLowerCase()}`), 200);
  });

  it('never repeats a receipt number under 5 concurrent payments', async () => {
    const payers = others.slice(0, 5);
    const results = await Promise.all(
      payers.map((student) =>
        ctx
          .api(director)
          .post('/api/finance/payments')
          .send({ studentId: student.id, amount: 50_000, method: 'efectivo', chargeIds: [chargeOf.get(student.id)] }),
      ),
    );
    results.forEach((res) => expectStatus(res, 201));
    const numbers = results.map((res) => res.body.receiptNumber as string);
    expect(new Set(numbers).size).toBe(5);
    const sequence = numbers.map((n) => Number(n.slice(-6))).sort((a, b) => a - b);
    expect(sequence[4] - sequence[0]).toBe(4); // consecutive, no gaps
    expect(sequence[0]).toBe(receiptsBefore + 1);
    results.forEach((res) =>
      expect(res.body.applications[0]).toMatchObject({ chargeStatus: 'partial', chargePending: FEE - 50_000 }),
    );
  });

  it('returns the account statement with charges, payments and credit balance', async () => {
    const res = await ctx.api(director).get(`/api/finance/students/${family.id}/account-statement`);
    expectStatus(res, 200);
    expect(res.body.summary).toMatchObject({ creditBalance: 5_000 });
    expect(res.body.payments.map((p: { receiptNumber: string }) => p.receiptNumber)).toContain(receipt);
    expect(res.body.charges.find((c: { id: number }) => c.id === chargeOf.get(family.id)).status).toBe('paid');
  });

  it('voids a payment and re-opens its charge, keeping the receipt number', async () => {
    const target = others[0];
    const payments = await ctx.api(director).get(`/api/finance/students/${target.id}/payments`);
    expectStatus(payments, 200);
    const list = Array.isArray(payments.body) ? payments.body : payments.body.items;
    const toVoid = list[0];

    const voided = await ctx
      .api(director)
      .post(`/api/finance/payments/${toVoid.id}/void`)
      .send({ reason: 'Registrado por error' });
    expectStatus(voided, 200);
    expect(voided.body).toMatchObject({
      receiptNumber: toVoid.receiptNumber,
      revertedCharges: [chargeOf.get(target.id)],
    });

    const charges = await ctx.api(director).get(`/api/finance/charges?studentId=${target.id}&conceptId=${conceptId}`);
    expect(charges.body.items[0]).toMatchObject({ status: 'pending', pendingAmount: FEE });
    const twice = await ctx.api(director).post(`/api/finance/payments/${toVoid.id}/void`).send({ reason: 'otra vez' });
    expectStatus(twice, 409, 422);
  });

  it('reconciles transfers against the bank reference (unique regardless of case)', async () => {
    const pay = (student: EnrolledStudent) =>
      ctx
        .api(director)
        .post('/api/finance/payments')
        .send({
          studentId: student.id,
          amount: 10_000,
          method: 'transferencia',
          reference: 'TRF-1',
          chargeIds: [chargeOf.get(student.id)],
        });
    const first = await pay(others[1]);
    const second = await pay(others[2]);
    expectStatus(first, 201);
    expectStatus(second, 201);
    const bankRef = `TRX-E2E-${uniqueSuffix()}`;

    const reconciled = await ctx
      .api(director)
      .post(`/api/finance/payments/${first.body.paymentId}/reconcile`)
      .send({ bankRef });
    expectStatus(reconciled, 200);
    const duplicate = await ctx
      .api(director)
      .post(`/api/finance/payments/${second.body.paymentId}/reconcile`)
      .send({ bankRef: ` ${bankRef.toLowerCase()} ` });
    expectStatus(duplicate, 409);

    const month = todayInBogota().slice(0, 7);
    const report = await ctx.api(director).get(`/api/finance/reconciliation?month=${month}`);
    expectStatus(report, 200);
    expect(report.body.month).toBe(month);
    expect(report.body.reconciled.count).toBeGreaterThanOrEqual(1);
    expect(report.body.payments.map((p: { id: number }) => p.id)).toContain(first.body.paymentId);

    const undo = await ctx.api(director).delete(`/api/finance/payments/${first.body.paymentId}/reconcile`);
    expectStatus(undo, 200, 204);
  });

  it('reports the overdue portfolio (cartera)', async () => {
    const res = await ctx.api(director).get('/api/finance/aging');
    expectStatus(res, 200);
    expect(res.body.today).toBe(todayInBogota());
    const debtor = res.body.debtors.find((d: { studentId: number }) => d.studentId === others[0].id);
    expect(debtor).toMatchObject({ oldestDueDate: DUE_DATE, balance: FEE });
    expect(debtor.daysOverdue).toBeGreaterThan(0);
    expect(res.body.debtors.some((d: { studentId: number }) => d.studentId === family.id)).toBe(false);
  });

  it('shows the dashboard', async () => {
    expectStatus(await ctx.api(director).get('/api/finance/dashboard'), 200);
  });

  describe('guardian portal', () => {
    let parent: string;

    beforeAll(async () => {
      const account = family.accounts.find((a) => a.holder === 'guardian')!;
      parent = await ctx.login(account.email!, account.temporaryPassword!);
      await ctx
        .api(parent)
        .patch('/api/auth/password')
        .send({ currentPassword: account.temporaryPassword, newPassword: NEW_PASSWORD })
        .expect(204);
    });

    it('lists only their students', async () => {
      const res = await ctx.api(parent).get('/api/finance/portal/students');
      expectStatus(res, 200);
      const ids = (Array.isArray(res.body) ? res.body : res.body.items).map((s: { id: number }) => s.id);
      expect(ids).toEqual([family.id]);
    });

    it('reads the account statement and receipt of their student but not of others', async () => {
      expectStatus(await ctx.api(parent).get(`/api/finance/students/${family.id}/account-statement`), 200);
      expectStatus(await ctx.api(parent).get(`/api/finance/receipts/${receipt}`), 200);
      expectStatus(await ctx.api(parent).get(`/api/finance/students/${others[0].id}/account-statement`), 403);
      expectStatus(
        await ctx
          .api(parent)
          .post('/api/finance/payments')
          .send({ studentId: family.id, amount: 1, method: 'efectivo' }),
        403,
      );
    });
  });
});
