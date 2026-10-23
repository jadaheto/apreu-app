import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { TypeOrmVoucherSequence } from './typeorm-voucher-sequence.js';

describe('TypeOrmVoucherSequence', () => {
  const query = vi.fn();
  const sequence = new TypeOrmVoucherSequence({ manager: async () => ({ query }) } as unknown as TenantDataSource);

  beforeEach(() =>
    query
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ lastNumber: 42 }]),
  );

  it('seeds the type once and increments it atomically with an upsert RETURNING', async () => {
    await expect(sequence.next('RC')).resolves.toBe('000042');
    const [[seed, seedParams], [increment, incrementParams]] = query.mock.calls;
    expect(seed).toMatch(/NOT EXISTS \(SELECT 1 FROM accounting_sequences WHERE entry_type = \$1::varchar\)/);
    expect(seed).toMatch(/ON CONFLICT \(entry_type\) DO NOTHING/);
    expect(seed).toMatch(/entry_number ~ '\^\[0-9\]\{1,9\}\$'/);
    expect(increment).toMatch(/ON CONFLICT \(entry_type\) DO UPDATE SET last_number = s\.last_number \+ 1\s+RETURNING/);
    expect(seedParams).toEqual(['RC']);
    expect(incrementParams).toEqual(['RC']);
  });
});
