import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../shared/application/use-case.js';
import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { INSTITUTION_SETTINGS, type InstitutionSettingsPort } from '../domain/institution-settings.port.js';
import type { StudentDetails } from '../domain/student.js';
import { STUDENT_REPOSITORY, type StudentRepository } from '../domain/student.repository.js';
import { ClassroomPlacement } from './classroom-placement.js';
import { academicYearOf, todayIn } from './school-calendar.js';
import { StudentViewAssembler } from './student-view.assembler.js';
import type { StudentView } from './views.js';

export interface UpdateStudentInput {
  studentId: number;
  details: StudentDetails;
  /** `undefined` keeps the classroom; `null` removes the assignment. */
  classroomId?: number | null;
}

/**
 * Edits the personal, health and enrollment data of a student (legacy
 * `students/create.php?edit=`). The code is immutable and the status changes
 * through {@link ChangeStudentStatusUseCase}. Guardian data is edited on the
 * guardian itself, since it is shared between siblings.
 */
@Injectable()
export class UpdateStudentUseCase implements UseCase<UpdateStudentInput, StudentView> {
  constructor(
    @Inject(STUDENT_REPOSITORY) private readonly students: StudentRepository,
    @Inject(INSTITUTION_SETTINGS)
    private readonly settings: InstitutionSettingsPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly placement: ClassroomPlacement,
    private readonly assembler: StudentViewAssembler,
  ) {}

  async execute(input: UpdateStudentInput): Promise<StudentView> {
    const student = await this.students.findById(input.studentId);
    if (!student) throw new NotFoundError('Estudiante', input.studentId);

    student.updateDetails(input.details, todayIn(this.clock));
    const duplicate = await this.students.findByDocument(student.documentType, student.documentNumber as string);
    if (duplicate && duplicate.id !== student.id) {
      throw new ConflictError(
        `Ya existe otro estudiante con el documento ${student.documentType} ${student.documentNumber}.`,
        {
          studentId: duplicate.id,
        },
      );
    }

    if (input.classroomId !== undefined && input.classroomId !== student.classroomId) {
      const academicYear = academicYearOf(await this.settings.load(), this.clock);
      const classroom = await this.placement.resolve(input.classroomId, academicYear);
      student.assignClassroom(classroom?.id ?? null, classroom?.academicYear ?? null);
    }

    await this.students.save(student);
    return this.assembler.toView(student);
  }
}
