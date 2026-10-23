import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { toOffset, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { IsoDate } from '../../domain/common/calendar-date.js';
import type { LeaveRequest } from '../../domain/leaves/leave-request.js';
import type { LeaveRequestRepository, LeaveSearchCriteria } from '../../domain/leaves/leave-request.repository.js';
import { LeaveRequestMapper } from './leave-request.mapper.js';
import { LeaveRequestOrmEntity } from './leave-request.orm-entity.js';

/** TypeORM adapter of {@link LeaveRequestRepository}. */
@Injectable()
export class TypeOrmLeaveRequestRepository implements LeaveRequestRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<LeaveRequest | null> {
    const row = await (await this.db.repository(LeaveRequestOrmEntity)).findOneBy({ id });
    return row ? LeaveRequestMapper.toDomain(row) : null;
  }

  async search(criteria: LeaveSearchCriteria, page: PageRequest): Promise<Paginated<LeaveRequest>> {
    const query = (await this.db.repository(LeaveRequestOrmEntity)).createQueryBuilder('l');
    if (criteria.employeeId !== undefined)
      query.andWhere('l.employee_id = :employeeId', { employeeId: criteria.employeeId });
    if (criteria.status) query.andWhere('l.status = :status', { status: criteria.status });
    if (criteria.from) query.andWhere('l.end_date >= :from', { from: criteria.from });
    if (criteria.to) query.andWhere('l.start_date <= :to', { to: criteria.to });
    const [rows, total] = await query
      .orderBy('l.created_at', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(LeaveRequestMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async findActiveOverlapping(
    employeeId: number,
    start: IsoDate,
    end: IsoDate,
    excludeId?: number,
  ): Promise<LeaveRequest[]> {
    const query = (await this.db.repository(LeaveRequestOrmEntity))
      .createQueryBuilder('l')
      .where('l.employee_id = :employeeId', { employeeId })
      .andWhere("l.status IN ('pending', 'approved')")
      .andWhere('l.start_date <= :end AND l.end_date >= :start', { start, end });
    if (excludeId !== undefined) query.andWhere('l.id <> :excludeId', { excludeId });
    return (await query.getMany()).map(LeaveRequestMapper.toDomain);
  }

  async findApprovedInRange(employeeIds: number[], start: IsoDate, end: IsoDate): Promise<LeaveRequest[]> {
    if (employeeIds.length === 0) return [];
    const rows = await (
      await this.db.repository(LeaveRequestOrmEntity)
    )
      .createQueryBuilder('l')
      .where({ employeeId: In(employeeIds) })
      .andWhere("l.status = 'approved'")
      .andWhere('l.start_date <= :end AND l.end_date >= :start', { start, end })
      .orderBy('l.start_date', 'ASC')
      .getMany();
    return rows.map(LeaveRequestMapper.toDomain);
  }

  async save(leave: LeaveRequest): Promise<void> {
    const saved = await (await this.db.repository(LeaveRequestOrmEntity)).save(LeaveRequestMapper.toPersistence(leave));
    if (leave.isNew) leave.assignId(saved.id);
  }
}
