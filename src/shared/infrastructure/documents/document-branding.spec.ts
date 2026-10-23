import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TenantDataSource } from '../persistence/tenant-data-source.js';
import { TenantContext } from '../tenancy/tenant-context.js';
import { DEFAULT_BRAND_COLOR, DocumentBrandingProvider } from './document-branding.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const tenant = { id: 1, slug: 'demo', name: 'Demo', status: 'active' as const, databaseName: 'apreu_demo' };

describe('DocumentBrandingProvider', () => {
  const context = new TenantContext();
  let root: string;
  let query: ReturnType<typeof vi.fn>;

  const provider = (template: string | null = null) =>
    new DocumentBrandingProvider({ manager: async () => ({ query }) } as unknown as TenantDataSource, context, {
      storage: { uploadsDir: root },
      documentVerifyUrlTemplate: template,
    });
  const answer = (institution: Record<string, unknown> | null, settings: { key: string; value: string }[] = []) =>
    query.mockImplementation(async (sql: string) =>
      sql.includes('institutions') ? (institution ? [institution] : []) : settings,
    );

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'apreu-branding-'));
    query = vi.fn();
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it('loads the uploaded logo as a data URL, the primary color and contact data', async () => {
    await mkdir(join(root, 'demo', 'institution'), { recursive: true });
    await writeFile(join(root, 'demo', 'institution', 'logo-1.png'), PNG);
    answer(
      {
        name: 'Colegio Demo',
        nit: null,
        address: 'Calle 1',
        city: 'Sincelejo',
        phone: null,
        email: 'info@demo.co',
        logo: 'institution/logo-1.png',
      },
      [
        { key: 'primary_color', value: '#ABCDEF' },
        { key: 'school_nit', value: '900123456' },
      ],
    );
    const branding = await context.run(tenant, () => provider().load());
    expect(branding).toEqual({
      institutionName: 'Colegio Demo',
      nit: '900123456',
      logo: `data:image/png;base64,${PNG.toString('base64')}`,
      primaryColor: '#ABCDEF',
      contact: ['Calle 1', 'Sincelejo', 'info@demo.co'],
    });
  });

  it('ignores unsafe logo paths, unsupported formats and invalid colors', async () => {
    await mkdir(join(root, 'demo'), { recursive: true });
    await writeFile(join(root, 'demo', 'logo.webp'), Buffer.from('RIFF0000WEBP'));
    for (const logo of ['../otro/logo.png', 'logo.webp', 'missing.png']) {
      answer({ name: null, nit: null, address: null, city: null, phone: null, email: null, logo }, [
        { key: 'color_primary', value: 'red' },
      ]);
      await expect(context.run(tenant, () => provider().load())).resolves.toEqual({
        institutionName: null,
        nit: null,
        logo: null,
        primaryColor: DEFAULT_BRAND_COLOR,
        contact: [],
      });
    }
  });

  it('never fails a document when the database is unavailable', async () => {
    query.mockRejectedValue(new Error('down'));
    await expect(context.run(tenant, () => provider().load())).resolves.toMatchObject({ logo: null });
  });

  it('builds the verification QR target', () => {
    expect(provider().verificationTarget('laboral', 'AB-12')).toBe('AB-12');
    expect(
      context.run(tenant, () =>
        provider('https://{tenant}.apreu.co/verificar/{code}?tipo={kind}').verificationTarget('estudiantil', 'AB 12'),
      ),
    ).toBe('https://demo.apreu.co/verificar/AB%2012?tipo=estudiantil');
  });
});
