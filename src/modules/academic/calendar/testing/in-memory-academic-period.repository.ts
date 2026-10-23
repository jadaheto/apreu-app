import { InMemoryStore } from '../../../../shared/testing/fakes.js';
import type { AcademicPeriod } from '../domain/academic-period.js';
import type { AcademicPeriodRepository } from '../domain/academic-period.repository.js';

export class InMemoryAcademicPeriodRepository implements AcademicPeriodRepository {
  readonly store = new InMemoryStore<AcademicPeriod>();
  /** Period ids that have grades recorded. */
  readonly graded = new Set<number>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: readonly number[]) {
    return ids.flatMap((id) => this.store.get(id) ?? []);
  }
  async listByYear(year: number) {
    return this.store
      .all()
      .filter((p) => p.academicYear === year)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
  async hasGrades(periodId: number) {
    return this.graded.has(periodId);
  }
  async save(period: AcademicPeriod) {
    this.store.save(period);
  }
  async delete(id: number) {
    this.store.items.delete(id);
  }
}
