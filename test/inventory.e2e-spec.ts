import { createE2eApp, DIRECTOR, type E2eContext, uniqueSuffix } from './support/e2e-app.js';
import { expectStatus } from './support/http.js';

describe('inventory (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let categoryId: number;
  let itemId: number;
  const sku = `UNI-E2E-${uniqueSuffix()}`.toUpperCase();

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
  });
  afterAll(() => ctx?.close());

  it('creates a category; a name differing only in case/accents is a duplicate', async () => {
    const name = `Uniformes ${uniqueSuffix()}`;
    const res = await ctx.api(director).post('/api/inventory/categories').send({ name });
    expectStatus(res, 201);
    categoryId = res.body.id;
    expectStatus(await ctx.api(director).post('/api/inventory/categories').send({ name: name.toUpperCase() }), 409);
  });

  it('creates an item with initial stock; the SKU is unique regardless of case', async () => {
    const res = await ctx.api(director).post('/api/inventory/items').send({
      name: 'Camiseta uniforme talla 10',
      sku,
      categoryId,
      unit: 'und',
      unitCost: 20_000,
      salePrice: 35_000,
      minStock: 5,
      initialStock: 10,
    });
    expectStatus(res, 201);
    itemId = res.body.id;
    expect(res.body).toMatchObject({ sku, stock: 10 });

    const duplicate = await ctx.api(director).post('/api/inventory/items').send({
      name: 'Otra',
      sku: sku.toLowerCase(),
      unitCost: 1,
      salePrice: 1,
      minStock: 0,
    });
    expectStatus(duplicate, 409);
  });

  it('records movements and keeps the kardex (running balance)', async () => {
    const out = await ctx
      .api(director)
      .post(`/api/inventory/items/${itemId}/movements`)
      .send({ type: 'salida', quantity: 7, reason: 'Venta' });
    expectStatus(out, 201);
    const entry = await ctx
      .api(director)
      .post(`/api/inventory/items/${itemId}/movements`)
      .send({ type: 'entrada', quantity: 4, unitCost: 21_000, reason: 'Compra' });
    expectStatus(entry, 201);

    const tooMuch = await ctx
      .api(director)
      .post(`/api/inventory/items/${itemId}/movements`)
      .send({ type: 'salida', quantity: 100 });
    expectStatus(tooMuch, 422);

    const item = await ctx.api(director).get(`/api/inventory/items/${itemId}`);
    expectStatus(item, 200);
    expect(item.body.stock).toBe(7);

    const kardex = await ctx.api(director).get(`/api/inventory/items/${itemId}/movements`);
    expectStatus(kardex, 200);
    const movements = Array.isArray(kardex.body) ? kardex.body : kardex.body.items;
    expect(movements.length).toBeGreaterThanOrEqual(3);
    const text = JSON.stringify(kardex.body);
    expect(text).toContain('salida');
    expect(text).toContain('entrada');
  });

  it('raises the low-stock alert and reports KPIs and valuation', async () => {
    const out = await ctx
      .api(director)
      .post(`/api/inventory/items/${itemId}/movements`)
      .send({ type: 'salida', quantity: 3 });
    expectStatus(out, 201);
    const alerts = await ctx.api(director).get('/api/inventory/alerts');
    expectStatus(alerts, 200);
    expect(JSON.stringify(alerts.body)).toContain(sku);
    expectStatus(await ctx.api(director).get('/api/inventory/kpis'), 200);
    expectStatus(await ctx.api(director).get('/api/inventory/valuation'), 200);
  });

  it('searches items by SKU in lower case', async () => {
    const res = await ctx.api(director).get(`/api/inventory/items?search=${sku.toLowerCase()}`);
    expectStatus(res, 200);
    expect(JSON.stringify(res.body)).toContain(sku);
  });
});
