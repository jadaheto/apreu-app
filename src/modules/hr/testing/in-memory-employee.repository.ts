import { toOffset, type PageRequest, type Paginated } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { IsoDate } from '../domain/common/calendar-date.js';
import { EMPLOYEE_TYPES, type EmployeeType } from '../domain/employees/employee-catalogs.js';
import type { Employee } from '../domain/employees/employee.js';
import {
  formatEmployeeCode,
  type EmployeeKpis,
  type EmployeeRepository,
  type EmployeeSearchCriteria,
} from '../domain/employees/employee.repository.js';

export class InMemoryEmployeeRepository implements EmployeeRepository {
  readonly store = new InMemoryStore<Employee>();

  async findById(id: number): Promise<Employee | null> {
    return this.store.get(id);
  }

  async findByIds(ids: number[]): Promise<Employee[]> {
    return this.store.all().filter((e) => ids.includes(e.id as number));
  }

  async findByUserId(userId: number): Promise<Employee | null> {
    return this.store.all().find((e) => e.userId === userId) ?? null;
  }

  async existsByDocument(documentNumber: string, excludeId?: number): Promise<boolean> {
    return this.store.all().some((e) => e.documentNumber === documentNumber && e.id !== excludeId);
  }

  async existsByUserId(userId: number, excludeId?: number): Promise<boolean> {
    return this.store.all().some((e) => e.userId === userId && e.id !== excludeId);
  }

  async nextCode(): Promise<string> {
    const max = Math.max(0, ...this.store.all().map((e) => Number(/^EMP(\d+)$/.exec(e.code)?.[1] ?? 0)));
    return formatEmployeeCode(max + 1);
  }

  async search(criteria: EmployeeSearchCriteria, page: PageRequest): Promise<Paginated<Employee>> {
    const term = criteria.search?.toLowerCase();
    const matches = this.store
      .all()
      .filter((e) => !criteria.type || e.employeeType === criteria.type)
      .filter((e) => !criteria.status || e.status === criteria.status)
      .filter((e) => !term || `${e.fullName} ${e.code} ${e.documentNumber}`.toLowerCase().includes(term));
    const offset = toOffset(page);
    return { items: matches.slice(offset, offset + page.limit), total: matches.length, ...page };
  }

  async kpis(): Promise<EmployeeKpis> {
    const active = this.store.all().filter((e) => e.status === 'active');
    const byType = Object.fromEntries(
      EMPLOYEE_TYPES.map((t) => [t, active.filter((e) => e.employeeType === t).length]),
    );
    return {
      active: active.length,
      onLeave: this.store.all().filter((e) => e.status === 'on_leave').length,
      byType: byType as Record<EmployeeType, number>,
    };
  }

  async findPayrollCandidates(periodStart: IsoDate): Promise<Employee[]> {
    return this.store
      .all()
      .filter((e) => !e.isContractor)
      .filter((e) => ['active', 'on_leave'].includes(e.status) || (e.retirementDate ?? '') >= periodStart);
  }

  async save(employee: Employee): Promise<void> {
    this.store.save(employee);
  }
}
