import { randomBytes } from 'node:crypto';
import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { issuerConfig } from '../../testing/fixtures.js';
import { SecretCipher } from './secret-cipher.js';
import { SettingsIssuerConfigRepository } from './settings-issuer-config.repository.js';

describe('SettingsIssuerConfigRepository', () => {
  const settings = new Map<string, string>();
  const manager = {
    query: vi.fn(async (sql: string, params?: string[][]) => {
      if (sql.startsWith('SELECT')) return [...settings].map(([key, value]) => ({ key, value }));
      // Single upsert: parallel arrays of keys and values (unnest).
      const [keys, values] = params!;
      keys.forEach((key, index) => settings.set(key, values[index]));
      return [];
    }),
  };
  const db = { manager: async () => manager } as unknown as TenantDataSource;
  const repository = new SettingsIssuerConfigRepository(
    db,
    SecretCipher.fromBase64(randomBytes(32).toString('base64')),
  );

  beforeEach(() => {
    settings.clear();
    manager.query.mockClear();
  });

  it('stores the configuration in legacy keys with the PIN encrypted and reads it back', async () => {
    await repository.save(issuerConfig({ autoInvoiceOnPayment: true, testSetId: 'set-1' }));
    expect(settings.get('dian_nit')).toBe('900123456');
    expect(settings.get('dian_dv')).toBe('8');
    expect(settings.get('dian_city_code')).toBe('70001');
    expect(settings.get('dian_auto_invoice_on_payment')).toBe('1');
    expect(settings.get('dian_software_pin')).toMatch(/^enc:v1:/);
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.query.mock.calls[0][0]).toMatch(/ON CONFLICT \(key\) DO UPDATE SET value = EXCLUDED\.value/);

    const config = await repository.get();
    expect(config.toProps()).toEqual(issuerConfig({ autoInvoiceOnPayment: true, testSetId: 'set-1' }).toProps());
  });

  it('reads legacy schools (plaintext PIN, defaults for new keys)', async () => {
    settings.set('dian_business_name', 'Colegio Legacy');
    settings.set('dian_software_pin', '54321');
    settings.set('dian_environment', '1');
    const config = await repository.get();
    expect(config).toMatchObject({
      businessName: 'Colegio Legacy',
      softwarePin: '54321',
      environment: '1',
      fileNaming: 'annex',
      vatRegime: '49',
      autoInvoiceOnPayment: false,
    });
  });
});
