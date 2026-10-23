import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { NotFoundError } from '../../../shared/domain/domain-error.js';
import { CERTIFICATE_REPOSITORY, type CertificateRepository } from '../domain/certificate.repository.js';
import { INCIDENT_REPOSITORY, type IncidentRepository } from '../domain/incident.repository.js';
import {
  STUDENT_FINANCE,
  type FinancialSummary,
  type PaymentRecord,
  type StudentFinancePort,
} from '../domain/student-finance.port.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { IncidentViewAssembler, type IncidentDetailView } from './incident-view.assembler.js';
import { todayIn } from './school-calendar.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import { toCertificateView, type CertificateView, type StudentView } from './views.js';

export interface StudentProfileView {
  student: StudentView;
  finance: FinancialSummary & { recentPayments: PaymentRecord[] };
  incidents: IncidentDetailView[];
  certificates: CertificateView[];
}

const RECENT_PAYMENTS = 5;
const RECENT_INCIDENTS = 10;

/**
 * 360° record of a student for the school office (legacy
 * `students/view.php`): personal data, guardian, financial summary, last
 * payments, incidents (with the reviewer resolved from `users`, bug B2) and
 * certificates. Report cards belong to the academic context.
 * Unlike the legacy page, incidents load even if another section fails (B1).
 */
@Injectable()
export class GetStudentProfileUseCase implements UseCase<number, StudentProfileView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(INCIDENT_REPOSITORY) private readonly incidents: IncidentRepository,
    @Inject(CERTIFICATE_REPOSITORY)
    private readonly certificates: CertificateRepository,
    @Inject(STUDENT_FINANCE) private readonly finance: StudentFinancePort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly studentViews: StudentViewAssembler,
    private readonly incidentViews: IncidentViewAssembler,
  ) {}

  async execute(studentId: number): Promise<StudentProfileView> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundError('Estudiante', studentId);

    const [view, summary, recentPayments, incidents, certificates] = await Promise.all([
      this.studentViews.toView(student),
      this.finance.summary(studentId, todayIn(this.clock)),
      this.finance.payments(studentId, RECENT_PAYMENTS),
      this.incidents.search({ studentId }, { page: 1, limit: RECENT_INCIDENTS }),
      this.certificates.listByStudent(studentId),
    ]);
    return {
      student: view,
      finance: { ...summary, recentPayments },
      incidents: await this.incidentViews.toViews(incidents.items),
      certificates: certificates.map(toCertificateView),
    };
  }
}
