import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { RecordingQueryBuilder } from '../../../../shared/testing/fakes.js';
import { SqlPaymentQueries } from './queries/sql-payment-queries.js';
import { TypeOrmPaymentRepository } from './typeorm-payment.repository.js';

/** ADR-0008: references typed by people ignore case, as MariaDB `utf8mb4_general_ci` did. */
describe('finance case-insensitive lookups', () => {
  it('treats bank references that differ only in case or spaces as the same', async () => {
    const qb = new RecordingQueryBuilder({ count: 1 });
    const payments = new TypeOrmPaymentRepository(qb.asDataSource<TenantDataSource>());
    await expect(payments.isBankRefTaken('trx-1 ', 9)).resolves.toBe(true);
    expect(qb.conditions[0]).toBe('upper(btrim(p.bank_ref)) = upper(btrim(:bankRef))');
    expect(qb.parameters).toMatchObject({ bankRef: 'trx-1 ', id: 9 });
  });

  it('finds a receipt typed in lower case, preferring the exact match', async () => {
    const query = vi.fn().mockResolvedValue([]);
    const queries = new SqlPaymentQueries({ manager: async () => ({ query }) } as unknown as TenantDataSource);
    await expect(queries.findReceipt(' rc-2026-000123 ')).resolves.toBeNull();
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/WHERE upper\(p\.receipt_no\) = upper\(\$1\) ORDER BY \(p\.receipt_no = \$1\) DESC LIMIT 1/);
    expect(params).toEqual(['rc-2026-000123']);
  });
});
