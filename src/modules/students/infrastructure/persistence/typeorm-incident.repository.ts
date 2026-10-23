import { Injectable } from '@nestjs/common';
import { toOffset, type Paginated, type PageRequest } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import { INCIDENT_STATUSES, type Incident, type IncidentStatus } from '../../domain/incident.js';
import type { IncidentRepository, IncidentSearchCriteria } from '../../domain/incident.repository.js';
import { IncidentOrmEntity } from './incident.orm-entity.js';
import { IncidentMapper } from './mappers.js';

/** TypeORM adapter of {@link IncidentRepository}. */
@Injectable()
export class TypeOrmIncidentRepository implements IncidentRepository {
  constructor(private readonly db: TenantDataSource) {}

  private repository() {
    return this.db.repository(IncidentOrmEntity);
  }

  async findById(id: number): Promise<Incident | null> {
    const row = await (await this.repository()).findOneBy({ id });
    return row ? IncidentMapper.toDomain(row) : null;
  }

  async search(criteria: IncidentSearchCriteria, page: PageRequest): Promise<Paginated<Incident>> {
    const [rows, total] = await (
      await this.repository()
    ).findAndCount({
      where: {
        ...(criteria.status && { status: criteria.status }),
        ...(criteria.type && { type: criteria.type }),
        ...(criteria.studentId && { studentId: criteria.studentId }),
      },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: toOffset(page),
      take: page.limit,
    });
    return {
      items: rows.map(IncidentMapper.toDomain),
      total,
      page: page.page,
      limit: page.limit,
    };
  }

  async countByStatus(): Promise<Record<IncidentStatus, number>> {
    const rows: { status: IncidentStatus; total: string }[] = await (
      await this.repository()
    )
      .createQueryBuilder('i')
      .select('i.status', 'status')
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('i.status')
      .getRawMany();
    const counts = Object.fromEntries(INCIDENT_STATUSES.map((status) => [status, 0])) as Record<IncidentStatus, number>;
    for (const row of rows) if (row.status in counts) counts[row.status] = Number(row.total);
    return counts;
  }

  async save(incident: Incident): Promise<void> {
    const saved = await (await this.repository()).save(IncidentMapper.toPersistence(incident));
    if (incident.isNew) incident.assignId(saved.id);
  }
}
