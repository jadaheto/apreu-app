import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { RecordingQueryBuilder } from '../../../../shared/testing/fakes.js';
import { TypeOrmGuardianRepository } from './typeorm-guardian.repository.js';
import { TypeOrmStudentRepository } from './typeorm-student.repository.js';

/** ADR-0008: duplicate checks by document ignore case, as MariaDB `utf8mb4_general_ci` did. */
describe('student/guardian document lookups', () => {
  it('finds a student by document type and case-insensitive number', async () => {
    const qb = new RecordingQueryBuilder();
    await expect(
      new TypeOrmStudentRepository(qb.asDataSource<TenantDataSource>()).findByDocument('PP', ' ab123 '),
    ).resolves.toBeNull();
    expect(qb.conditions).toEqual([
      's.document_type = :documentType',
      'upper(s.document_number) = upper(:documentNumber)',
    ]);
    expect(qb.parameters).toEqual({ documentType: 'PP', documentNumber: 'ab123' });
  });

  it('finds a guardian by case-insensitive document number', async () => {
    const qb = new RecordingQueryBuilder();
    await new TypeOrmGuardianRepository(qb.asDataSource<TenantDataSource>()).findByDocumentNumber('x9 ');
    expect(qb.conditions).toEqual(['upper(g.document_number) = upper(:documentNumber)']);
    expect(qb.parameters).toEqual({ documentNumber: 'x9' });
  });
});
