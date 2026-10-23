import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { RecordingQueryBuilder } from '../../../../shared/testing/fakes.js';
import { TypeOrmEmployeeRepository } from './typeorm-employee.repository.js';

describe('TypeOrmEmployeeRepository.existsByDocument', () => {
  it('compares the document number without case (ADR-0008) and excludes the edited employee', async () => {
    const qb = new RecordingQueryBuilder({ exists: true });
    const repository = new TypeOrmEmployeeRepository(qb.asDataSource<TenantDataSource>());
    await expect(repository.existsByDocument(' pa-77x ', 4)).resolves.toBe(true);
    expect(qb.conditions).toEqual(['upper(e.document_number) = upper(:documentNumber)', 'e.id <> :excludeId']);
    expect(qb.parameters).toEqual({ documentNumber: 'pa-77x', excludeId: 4 });
  });
});
