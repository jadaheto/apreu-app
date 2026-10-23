import type { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { RecordingQueryBuilder } from '../../../../shared/testing/fakes.js';
import { TypeOrmWhatsAppTemplateRepository } from './typeorm-whatsapp-template.repository.js';

describe('TypeOrmWhatsAppTemplateRepository.findByName', () => {
  it('compares the template name without case (ADR-0008)', async () => {
    const qb = new RecordingQueryBuilder();
    await expect(
      new TypeOrmWhatsAppTemplateRepository(qb.asDataSource<TenantDataSource>()).findByName(' Pago_Recibido '),
    ).resolves.toBeNull();
    expect(qb.conditions).toEqual(['lower(t.name) = lower(:name)']);
    expect(qb.parameters).toEqual({ name: 'Pago_Recibido' });
  });
});
