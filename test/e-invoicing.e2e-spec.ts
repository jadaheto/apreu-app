import { createE2eApp, DIRECTOR, type E2eContext } from './support/e2e-app.js';
import { NEW_PASSWORD } from './support/fixtures.js';
import { expectStatus } from './support/http.js';
import { enrollStudent, type EnrolledStudent } from './support/students.js';

/**
 * Electronic invoicing with the DIAN web service replaced by a double. No
 * signing certificate is configured in the E2E environment, so only the
 * read side (listings, configuration, catalogs, portal) is exercised.
 */
describe('e-invoicing (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let family: EnrolledStudent;
  let parent: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
    family = await enrollStudent(ctx, director, { portal: true });
    const account = family.accounts.find((a) => a.holder === 'guardian')!;
    parent = await ctx.login(account.email!, account.temporaryPassword!);
    await ctx
      .api(parent)
      .patch('/api/auth/password')
      .send({ currentPassword: account.temporaryPassword, newPassword: NEW_PASSWORD })
      .expect(204);
  });
  afterAll(() => ctx?.close());

  it('lists documents and statistics', async () => {
    const list = await ctx.api(director).get('/api/e-invoicing/documents?limit=10');
    expectStatus(list, 200);
    expect(list.body).toMatchObject({ items: expect.any(Array), total: expect.any(Number) });
    expectStatus(await ctx.api(director).get('/api/e-invoicing/documents/stats'), 200);
  });

  it('reads the issuer configuration, resolutions and diagnostics', async () => {
    expectStatus(await ctx.api(director).get('/api/e-invoicing/config'), 200);
    expectStatus(await ctx.api(director).get('/api/e-invoicing/resolutions'), 200);
    const diagnostics = await ctx.api(director).get('/api/e-invoicing/diagnostics');
    expectStatus(diagnostics, 200);
  });

  it('serves the DIAN catalogs', async () => {
    const departments = await ctx.api(director).get('/api/e-invoicing/catalogs/dane-departments');
    expectStatus(departments, 200);
    const cities = await ctx.api(director).get('/api/e-invoicing/catalogs/dane/departments/11/cities');
    expectStatus(cities, 200);
  });

  it('the guardian portal lists the invoices of their student only', async () => {
    const mine = await ctx.api(parent).get(`/api/e-invoicing/portal/students/${family.id}/documents`);
    expectStatus(mine, 200);
    const other = await ctx.api(parent).get('/api/e-invoicing/portal/students/1/documents');
    expectStatus(other, 403);
    expectStatus(await ctx.api(parent).get('/api/e-invoicing/documents'), 403);
  });

  it('never called the DIAN web service (no document was submitted)', () => {
    expect(ctx.doubles.dian.calls).toEqual([]);
  });
});
