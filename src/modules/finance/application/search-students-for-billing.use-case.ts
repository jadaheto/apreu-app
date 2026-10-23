import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { STUDENT_DIRECTORY, type StudentDirectoryPort } from '../domain/student-directory.port.js';
import type { StudentSummaryView } from './views.js';

const MIN_TERM_LENGTH = 2;

/**
 * Typeahead of active students by name, code or document for the cashier and
 * the account statement (legacy loaded only the first 100 students, bug B9).
 */
@Injectable()
export class SearchStudentsForBillingUseCase implements UseCase<{ term: string; limit: number }, StudentSummaryView[]> {
  constructor(@Inject(STUDENT_DIRECTORY) private readonly students: StudentDirectoryPort) {}

  async execute({ term, limit }: { term: string; limit: number }): Promise<StudentSummaryView[]> {
    const trimmed = term?.trim() ?? '';
    if (trimmed.length < MIN_TERM_LENGTH) return [];
    return this.students.search(trimmed, limit);
  }
}
