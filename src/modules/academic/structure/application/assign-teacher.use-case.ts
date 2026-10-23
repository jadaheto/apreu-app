import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/domain-error.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { requireFound } from '../../common/domain/require-found.js';
import { STAFF_DIRECTORY, type StaffDirectoryPort } from '../../common/domain/staff-directory.port.js';
import {
  CLASSROOM_REPOSITORY,
  type ClassroomRepository,
  SUBJECT_REPOSITORY,
  type SubjectRepository,
  TEACHING_ASSIGNMENT_REPOSITORY,
  type TeachingAssignmentRepository,
} from '../domain/structure.repositories.js';
import { TeachingAssignment } from '../domain/teaching-assignment.js';
import { toAssignmentView, type TeachingAssignmentView } from './assignment-view.js';
import { requireEligibleTeacher } from './teacher-eligibility.js';

export interface AssignTeacherInput {
  employeeId: number;
  subjectId: number;
  classroomId: number;
}

/**
 * Assigns a teacher to a subject of a classroom for the classroom's year
 * (legacy `academic/assignments.php`). One teacher per (subject, classroom, year).
 */
@Injectable()
export class AssignTeacherUseCase implements UseCase<AssignTeacherInput, TeachingAssignmentView> {
  constructor(
    @Inject(TEACHING_ASSIGNMENT_REPOSITORY) private readonly assignments: TeachingAssignmentRepository,
    @Inject(CLASSROOM_REPOSITORY) private readonly classrooms: ClassroomRepository,
    @Inject(SUBJECT_REPOSITORY) private readonly subjects: SubjectRepository,
    @Inject(STAFF_DIRECTORY) private readonly staff: StaffDirectoryPort,
  ) {}

  async execute(input: AssignTeacherInput): Promise<TeachingAssignmentView> {
    const classroom = requireFound(await this.classrooms.findById(input.classroomId), 'Salón', input.classroomId);
    const subject = requireFound(await this.subjects.findById(input.subjectId), 'Materia', input.subjectId);
    await requireEligibleTeacher(this.staff, input.employeeId);
    if (await this.assignments.findOne(input.subjectId, input.classroomId, classroom.academicYear)) {
      throw new ConflictError('Esta materia ya tiene un docente asignado en este salón.');
    }
    const assignment = TeachingAssignment.create({ employeeId: input.employeeId, subject, classroom });
    await this.assignments.save(assignment);
    return toAssignmentView(assignment);
  }
}
