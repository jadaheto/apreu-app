import { createE2eApp, DIRECTOR, type E2eContext } from './support/e2e-app.js';
import { E2E } from './support/e2e-databases.js';

describe('institution (E2E)', () => {
  let ctx: E2eContext;
  let director: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
  });
  afterAll(() => ctx?.close());

  it('serves the public branding with only X-Tenant', async () => {
    const res = await ctx.api().get('/api/institution/branding');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      colorPrimary: expect.stringMatching(/^#[0-9a-f]{6}$/i),
      academicYear: expect.any(Number),
      logoUrl: null,
    });
  });

  it('accepts the tenant slug in any case', async () => {
    const res = await ctx.api(undefined, E2E.tenant.toUpperCase()).get('/api/institution/branding');
    expect(res.status).toBe(200);
  });

  it('updates the profile and the branding settings, reflected in the public branding', async () => {
    const profile = await ctx.api(director).put('/api/institution').send({
      name: 'Colegio E2E Núñez',
      nit: '900123456',
      documentType: 'NIT',
      personType: 'juridica',
      city: 'Bogotá',
      email: 'contacto@demo.co',
    });
    expect(profile.status).toBe(200);
    expect(profile.body.name).toBe('Colegio E2E Núñez');

    const section = await ctx
      .api(director)
      .put('/api/institution/settings/branding')
      .send({ values: { color_primary: '#123abc', logo_size: 52 } });
    expect(section.status).toBe(200);

    const read = await ctx.api(director).get('/api/institution/settings/branding');
    expect(read.status).toBe(200);
    expect(JSON.stringify(read.body)).toContain('#123abc');

    const branding = await ctx.api().get('/api/institution/branding');
    expect(branding.body).toMatchObject({ schoolName: 'Colegio E2E Núñez', colorPrimary: '#123abc', logoSize: 52 });
  });

  it('lists the settings catalog and validates values', async () => {
    const catalog = await ctx.api(director).get('/api/institution/settings');
    expect(catalog.status).toBe(200);
    const invalid = await ctx
      .api(director)
      .put('/api/institution/settings/branding')
      .send({ values: { color_primary: 'rojo' } });
    expect(invalid.status).toBe(422);
  });

  it('requires authentication for the settings', async () => {
    expect((await ctx.api().get('/api/institution/settings')).status).toBe(401);
  });
});
