import { toOffset, type Paginated, type PageRequest } from '../../../shared/domain/pagination.js';
import { InMemoryStore } from '../../../shared/testing/fakes.js';
import type { StudentDocumentType } from '../domain/catalogs.js';
import type { Certificate } from '../domain/certificate.js';
import type { CertificateRepository } from '../domain/certificate.repository.js';
import type { ClassroomInfo } from '../domain/classroom-directory.port.js';
import type { Guardian } from '../domain/guardian.js';
import type { GuardianRepository } from '../domain/guardian.repository.js';
import { INCIDENT_STATUSES, type Incident, type IncidentStatus } from '../domain/incident.js';
import type { IncidentRepository, IncidentSearchCriteria } from '../domain/incident.repository.js';
import type { Student } from '../domain/student.js';
import type { StudentRepository, StudentSearchCriteria } from '../domain/student.repository.js';

const paginate = <T>(items: T[], page: PageRequest): Paginated<T> => {
  const offset = toOffset(page);
  return {
    items: items.slice(offset, offset + page.limit),
    total: items.length,
    page: page.page,
    limit: page.limit,
  };
};

export class InMemoryStudentRepository implements StudentRepository {
  readonly store = new InMemoryStore<Student>();
  /** Classrooms used to resolve the grade/year filters, as the SQL adapter does with a subquery. */
  classrooms: ClassroomInfo[] = [];

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: number[]) {
    return this.store.all().filter((s) => ids.includes(s.id as number));
  }
  async findByDocument(documentType: StudentDocumentType, documentNumber: string) {
    return this.store.all().find((s) => s.documentType === documentType && s.documentNumber === documentNumber) ?? null;
  }
  async findByUserId(userId: number) {
    return this.store.all().find((s) => s.userId === userId) ?? null;
  }
  async findByGuardianId(guardianId: number) {
    return this.store
      .all()
      .filter((s) => s.guardianId === guardianId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
  async existsByCode(code: string) {
    return this.store.all().some((s) => s.code.toString() === code);
  }
  async search(criteria: StudentSearchCriteria, page: PageRequest) {
    const classroom = (s: Student) => this.classrooms.find((c) => c.id === s.classroomId);
    const term = criteria.search?.toLowerCase();
    const matches = this.store
      .all()
      .filter((s) => !criteria.status || s.status === criteria.status)
      .filter((s) => !criteria.classroomId || s.classroomId === criteria.classroomId)
      .filter((s) => !criteria.gradeId || classroom(s)?.gradeId === criteria.gradeId)
      .filter(
        (s) => !criteria.academicYear || s.classroomId === null || classroom(s)?.academicYear === criteria.academicYear,
      )
      .filter(
        (s) =>
          !term ||
          s.fullName.toLowerCase().includes(term) ||
          s.code.toString().toLowerCase().includes(term) ||
          (s.documentNumber ?? '').includes(term),
      )
      .sort((a, b) => a.lastName.localeCompare(b.lastName));
    return paginate(matches, page);
  }
  async save(student: Student) {
    this.store.save(student);
  }
}

export class InMemoryGuardianRepository implements GuardianRepository {
  readonly store = new InMemoryStore<Guardian>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByIds(ids: number[]) {
    return this.store.all().filter((g) => ids.includes(g.id as number));
  }
  async findByDocumentNumber(documentNumber: string) {
    return this.store.all().find((g) => g.documentNumber === documentNumber) ?? null;
  }
  async findByUserId(userId: number) {
    return this.store.all().find((g) => g.userId === userId) ?? null;
  }
  async save(guardian: Guardian) {
    this.store.save(guardian);
  }
}

export class InMemoryIncidentRepository implements IncidentRepository {
  readonly store = new InMemoryStore<Incident>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async search(criteria: IncidentSearchCriteria, page: PageRequest) {
    const matches = this.store
      .all()
      .filter((i) => !criteria.status || i.status === criteria.status)
      .filter((i) => !criteria.type || i.type === criteria.type)
      .filter((i) => !criteria.studentId || i.studentId === criteria.studentId)
      .sort((a, b) => (b.id as number) - (a.id as number));
    return paginate(matches, page);
  }
  async countByStatus() {
    const counts = Object.fromEntries(INCIDENT_STATUSES.map((s) => [s, 0])) as Record<IncidentStatus, number>;
    for (const incident of this.store.all()) counts[incident.status]++;
    return counts;
  }
  async save(incident: Incident) {
    this.store.save(incident);
  }
}

export class InMemoryCertificateRepository implements CertificateRepository {
  readonly store = new InMemoryStore<Certificate>();

  async findById(id: number) {
    return this.store.get(id);
  }
  async findByVerificationCode(code: string) {
    return this.store.all().find((c) => c.verificationCode === code) ?? null;
  }
  async listByStudent(studentId: number) {
    return this.store
      .all()
      .filter((c) => c.studentId === studentId)
      .sort((a, b) => (b.id as number) - (a.id as number));
  }
  async existsForPayment(paymentId: number) {
    return this.store.all().some((c) => c.paymentId === paymentId);
  }
  async save(certificate: Certificate) {
    this.store.save(certificate);
  }
}
