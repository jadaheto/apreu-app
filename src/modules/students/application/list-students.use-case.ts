import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { Paginated, PageRequest } from '../../../shared/domain/pagination.js';
import {
  STUDENT_REPOSITORY,
  type StudentRepository,
  type StudentSearchCriteria,
} from '../domain/student.repository.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentSummaryView } from './views.js';

export interface ListStudentsInput {
  criteria: StudentSearchCriteria;
  page: PageRequest;
}

/**
 * Student directory (legacy `students/index.php`) with server-side paging
 * instead of the fixed `LIMIT 200` (bug B25).
 */
@Injectable()
export class ListStudentsUseCase implements UseCase<ListStudentsInput, Paginated<StudentSummaryView>> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute({ criteria, page }: ListStudentsInput): Promise<Paginated<StudentSummaryView>> {
    const result = await this.students.search(criteria, page);
    return { ...result, items: await this.assembler.toSummaries(result.items) };
  }
}
