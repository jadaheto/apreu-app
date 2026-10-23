import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { RecordingQueryBuilder } from '../../../../shared/testing/fakes.js';
import { TypeOrmThirdPartyRepository } from './typeorm-third-party.repository.js';

describe('TypeOrmThirdPartyRepository.findByDocumentNumber', () => {
  it('compares the document number without case (ADR-0008)', async () => {
    const qb = new RecordingQueryBuilder();
    await expect(
      new TypeOrmThirdPartyRepository(qb.asDataSource<TenantDataSource>()).findByDocumentNumber(' e-123 '),
    ).resolves.toBeNull();
    expect(qb.conditions).toEqual(['upper(t.document_number) = upper(:documentNumber)']);
    expect(qb.parameters).toEqual({ documentNumber: 'e-123' });
  });
});
