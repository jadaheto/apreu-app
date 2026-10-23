import type { PageRequest, Paginated } from '../../../../shared/domain/pagination.js';
import type { IsoDate } from '../common/calendar-date.js';
import type { EmployeeStatus, EmployeeType } from './employee-catalogs.js';
import type { Employee } from './employee.js';

export interface EmployeeSearchCriteria {
  /** Matches full name, code or document number. */
  search?: string;
  type?: EmployeeType;
  status?: EmployeeStatus;
}

/** Headcount KPIs of the directory (`hr/index.php`). */
export interface EmployeeKpis {
  active: number;
  onLeave: number;
  byType: Record<EmployeeType, number>;
}

/** Output port for the {@link Employee} aggregate. There is intentionally no delete. */
export interface EmployeeRepository {
  findById(id: number): Promise<Employee | null>;
  findByIds(ids: number[]): Promise<Employee[]>;
  findByUserId(userId: number): Promise<Employee | null>;
  existsByDocument(documentNumber: string, excludeId?: number): Promise<boolean>;
  existsByUserId(userId: number, excludeId?: number): Promise<boolean>;
  /**
   * Next free `EMP####` code. Must be called inside a transaction: the
   * implementation locks the sequence so concurrent hires never collide
   * (fixes legacy B-1, `COUNT(*)+1` per year).
   */
  nextCode(): Promise<string>;
  search(criteria: EmployeeSearchCriteria, page: PageRequest): Promise<Paginated<Employee>>;
  kpis(): Promise<EmployeeKpis>;
  /** Non-contractor employees that may have contract days inside the period (eligibility is decided by the entity). */
  findPayrollCandidates(periodStart: IsoDate, periodEnd: IsoDate): Promise<Employee[]>;
  /** Inserts or updates; assigns the id to new employees. */
  save(employee: Employee): Promise<void>;
}

export const EMPLOYEE_REPOSITORY = Symbol('EmployeeRepository');

/** Formats the sequential employee code. */
export const formatEmployeeCode = (sequence: number): string => `EMP${String(sequence).padStart(4, '0')}`;
