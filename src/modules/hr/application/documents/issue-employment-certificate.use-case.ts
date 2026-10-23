import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { Guard } from '../../../../shared/domain/guard.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { amountInWords } from '../../domain/documents/amount-in-words.js';
import { INSTITUTION_PROFILE, type InstitutionProfilePort } from '../../domain/documents/institution-profile.port.js';
import {
  ISSUED_DOCUMENT_REPOSITORY,
  IssuedDocument,
  type IssuedDocumentRepository,
} from '../../domain/documents/issued-document.js';
import { CONTRACT_LABELS, DOCUMENT_LABELS } from '../../domain/employees/employee-catalogs.js';
import { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';
import { SECURE_RANDOM, type SecureRandomPort } from '../ports/secure-random.port.js';
import type { EmploymentCertificateContent, IssuedCertificateView } from './document-models.js';

export interface IssueEmploymentCertificateInput {
  actor: AuthenticatedActor;
  /** Omitted = the actor's own certificate. */
  employeeId?: number;
  includeSalary: boolean;
  addressee?: string | null;
}

/**
 * Issues an employment certificate with a persisted verification code
 * (replaces the three legacy implementations, D-3, and the unverifiable
 * signature, S-15). Uses current employee data and the issue date (rule 24);
 * the salary amount in words works again (B-4/B-5).
 */
@Injectable()
export class IssueEmploymentCertificateUseCase implements UseCase<
  IssueEmploymentCertificateInput,
  IssuedCertificateView
> {
  constructor(
    @Inject(ISSUED_DOCUMENT_REPOSITORY) private readonly documents: IssuedDocumentRepository,
    @Inject(INSTITUTION_PROFILE) private readonly institution: InstitutionProfilePort,
    @Inject(SECURE_RANDOM) private readonly random: SecureRandomPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly currentEmployee: CurrentEmployeeResolver,
  ) {}

  async execute(input: IssueEmploymentCertificateInput): Promise<IssuedCertificateView> {
    const { actor } = input;
    const employee = await this.currentEmployee.resolveTarget(actor, input.employeeId, isHrManager(actor));
    const addressee = input.addressee?.trim() || null;
    Guard.againstMaxLength(addressee, 150, 'destinatario');
    const issuedAt = this.clock.now();
    const verificationCode = this.random.verificationCode();
    const salary = input.includeSalary ? employee.baseSalary.amount : null;

    const content: EmploymentCertificateContent = {
      institution: await this.institution.get(),
      employeeName: employee.fullName,
      documentLabel: DOCUMENT_LABELS[employee.documentType],
      documentNumber: employee.documentNumber,
      position: employee.position,
      department: employee.department,
      contractLabel: CONTRACT_LABELS[employee.contractType],
      hireDate: employee.hireDate,
      retirementDate: employee.retirementDate,
      currentlyEmployed: employee.status !== 'retired',
      salary,
      salaryInWords: salary === null ? null : amountInWords(salary),
      addressee,
      issuedOn: CalendarDate.fromInstant(issuedAt),
      verificationCode,
    };
    await this.documents.save(
      IssuedDocument.issue({
        code: verificationCode,
        type: 'employment_certificate',
        employeeId: employee.id as number,
        content,
        issuedBy: actor.userId,
        issuedAt,
      }),
    );
    return { verificationCode, issuedAt, content };
  }
}
