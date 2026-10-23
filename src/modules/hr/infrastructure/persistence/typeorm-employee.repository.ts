import { Injectable } from '@nestjs/common';
import { Brackets, In, Not } from 'typeorm';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import { toOffset, type PageRequest, type Paginated } from '../../../../shared/domain/pagination.js';
import { TenantDataSource } from '../../../../shared/infrastructure/persistence/tenant-data-source.js';
import type { IsoDate } from '../../domain/common/calendar-date.js';
import { EMPLOYEE_TYPES, type EmployeeType } from '../../domain/employees/employee-catalogs.js';
import type { Employee } from '../../domain/employees/employee.js';
import {
  formatEmployeeCode,
  type EmployeeKpis,
  type EmployeeRepository,
  type EmployeeSearchCriteria,
} from '../../domain/employees/employee.repository.js';
import { EmployeeMapper } from './employee.mapper.js';
import { EmployeeOrmEntity } from './employee.orm-entity.js';
import { unaccentLike } from '../../../../shared/infrastructure/persistence/sql.js';

const CODE_SEQUENCE = 'employee_code';
/** PostgreSQL SQLSTATE of a unique-constraint violation. */
const UNIQUE_VIOLATION = '23505';

/** TypeORM adapter of {@link EmployeeRepository}. */
@Injectable()
export class TypeOrmEmployeeRepository implements EmployeeRepository {
  constructor(private readonly db: TenantDataSource) {}

  async findById(id: number): Promise<Employee | null> {
    const row = await (await this.db.repository(EmployeeOrmEntity)).findOneBy({ id });
    return row ? EmployeeMapper.toDomain(row) : null;
  }

  async findByIds(ids: number[]): Promise<Employee[]> {
    if (ids.length === 0) return [];
    const rows = await (await this.db.repository(EmployeeOrmEntity)).findBy({ id: In(ids) });
    return rows.map(EmployeeMapper.toDomain);
  }

  async findByUserId(userId: number): Promise<Employee | null> {
    const row = await (await this.db.repository(EmployeeOrmEntity)).findOneBy({ userId });
    return row ? EmployeeMapper.toDomain(row) : null;
  }

  /** Case-insensitive (ADR-0008), as MariaDB's `utf8mb4_general_ci` was (passports, foreign IDs). */
  async existsByDocument(documentNumber: string, excludeId?: number): Promise<boolean> {
    const query = (await this.db.repository(EmployeeOrmEntity))
      .createQueryBuilder('e')
      .where('upper(e.document_number) = upper(:documentNumber)', { documentNumber: documentNumber.trim() });
    if (excludeId) query.andWhere('e.id <> :excludeId', { excludeId });
    return query.getExists();
  }

  async existsByUserId(userId: number, excludeId?: number): Promise<boolean> {
    return (await this.db.repository(EmployeeOrmEntity)).exists({
      where: { userId, ...(excludeId ? { id: Not(excludeId) } : {}) },
    });
  }

  /**
   * Locks the `hr_sequences` row (SELECT … FOR UPDATE) so concurrent hires
   * get different numbers, and skips codes already taken manually.
   */
  async nextCode(): Promise<string> {
    const manager = await this.db.manager();
    await manager.query('INSERT INTO hr_sequences (name, last_value) VALUES ($1, 0) ON CONFLICT (name) DO NOTHING', [
      CODE_SEQUENCE,
    ]);
    const [{ last_value: last }]: { last_value: number }[] = await manager.query(
      'SELECT last_value FROM hr_sequences WHERE name = $1 FOR UPDATE',
      [CODE_SEQUENCE],
    );
    let next = Number(last) + 1;
    const repository = manager.getRepository(EmployeeOrmEntity);
    while (await repository.exists({ where: { code: formatEmployeeCode(next) } })) next++;
    await manager.query('UPDATE hr_sequences SET last_value = $1 WHERE name = $2', [next, CODE_SEQUENCE]);
    return formatEmployeeCode(next);
  }

  async search(criteria: EmployeeSearchCriteria, page: PageRequest): Promise<Paginated<Employee>> {
    const query = (await this.db.repository(EmployeeOrmEntity)).createQueryBuilder('e');
    if (criteria.type) query.andWhere('e.employee_type = :type', { type: criteria.type });
    if (criteria.status) query.andWhere('e.status = :status', { status: criteria.status });
    if (criteria.search?.trim()) {
      const term = `%${criteria.search.trim()}%`;
      query.andWhere(
        new Brackets((q) =>
          q
            .where(unaccentLike("e.first_name || ' ' || e.last_name", ':term'), { term })
            .orWhere('e.code ILIKE :term', { term })
            .orWhere('e.document_number ILIKE :term', { term }),
        ),
      );
    }
    const [rows, total] = await query
      .orderBy('e.last_name', 'ASC')
      .addOrderBy('e.first_name', 'ASC')
      .skip(toOffset(page))
      .take(page.limit)
      .getManyAndCount();
    return { items: rows.map(EmployeeMapper.toDomain), total, page: page.page, limit: page.limit };
  }

  async kpis(): Promise<EmployeeKpis> {
    const rows: { status: string; type: string; total: string }[] = await (
      await this.db.repository(EmployeeOrmEntity)
    )
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('e.employee_type', 'type')
      .addSelect('COUNT(*)::int', 'total')
      .groupBy('e.status')
      .addGroupBy('e.employee_type')
      .getRawMany();
    const byType = Object.fromEntries(EMPLOYEE_TYPES.map((t) => [t, 0])) as Record<EmployeeType, number>;
    let active = 0;
    let onLeave = 0;
    for (const row of rows) {
      const count = Number(row.total);
      if (row.status === 'on_leave') onLeave += count;
      if (row.status !== 'active') continue;
      active += count;
      if (row.type in byType) byType[row.type as EmployeeType] += count;
    }
    return { active, onLeave, byType };
  }

  async findPayrollCandidates(periodStart: IsoDate, periodEnd: IsoDate): Promise<Employee[]> {
    const rows = await (
      await this.db.repository(EmployeeOrmEntity)
    )
      .createQueryBuilder('e')
      .where("e.contract_type <> 'prestacion'")
      .andWhere('(e.hire_date IS NULL OR e.hire_date <= :periodEnd)', { periodEnd })
      .andWhere(
        new Brackets((q) =>
          q
            .where("e.status IN ('active', 'on_leave')")
            .orWhere("(e.status = 'retired' AND e.retirement_date >= :periodStart)", { periodStart }),
        ),
      )
      .orderBy('e.last_name', 'ASC')
      .getMany();
    return rows.map(EmployeeMapper.toDomain);
  }

  async save(employee: Employee): Promise<void> {
    try {
      const saved = await (await this.db.repository(EmployeeOrmEntity)).save(EmployeeMapper.toPersistence(employee));
      if (employee.isNew) employee.assignId(saved.id);
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new ConflictError('Ya existe un empleado con ese código o número de documento.');
      }
      throw error;
    }
  }
}
