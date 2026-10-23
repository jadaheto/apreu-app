import { Injectable } from '@nestjs/common';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { WhatsAppTemplateRepository } from '../../domain/whatsapp/whatsapp-template.repository.js';
import type { TemplateStatus, WhatsAppTemplate } from '../../domain/whatsapp/whatsapp-template.js';
import { WhatsAppTemplateMapper } from './mappers.js';
import { WhatsAppTemplateOrmEntity } from './orm-entities.js';

@Injectable()
export class TypeOrmWhatsAppTemplateRepository implements WhatsAppTemplateRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<WhatsAppTemplate | null> {
    const row = await (await this.db.repository(WhatsAppTemplateOrmEntity)).findOneBy({ id });
    return row ? WhatsAppTemplateMapper.toDomain(row) : null;
  }

  /**
   * Case-insensitive (ADR-0008): Meta names are lower-case, but MariaDB's
   * `utf8mb4_general_ci` also matched `Pago_Recibido` and legacy rows may keep capitals.
   */
  async findByName(name: string): Promise<WhatsAppTemplate | null> {
    const row = await (
      await this.db.repository(WhatsAppTemplateOrmEntity)
    )
      .createQueryBuilder('t')
      .where('lower(t.name) = lower(:name)', { name: name.trim() })
      .getOne();
    return row ? WhatsAppTemplateMapper.toDomain(row) : null;
  }

  async list(status?: TemplateStatus): Promise<WhatsAppTemplate[]> {
    const rows = await (
      await this.db.repository(WhatsAppTemplateOrmEntity)
    ).find({
      where: status ? { status } : {},
      order: { name: 'ASC' },
    });
    return rows.map(WhatsAppTemplateMapper.toDomain);
  }

  async save(template: WhatsAppTemplate): Promise<void> {
    const saved = await (
      await this.db.repository(WhatsAppTemplateOrmEntity)
    ).save(WhatsAppTemplateMapper.toPersistence(template));
    if (template.isNew) template.assignId(saved.id);
  }

  async delete(id: number): Promise<void> {
    await (await this.db.repository(WhatsAppTemplateOrmEntity)).delete({ id });
  }
}
