import { Role } from '../../../../shared/domain/role.js';
import { FakeUnitOfWork, FixedClock, RecordingEventBus } from '../../../../shared/testing/fakes.js';
import { GradeLinesService } from '../../assessment/application/grade-lines.service.js';
import { GradingContextService } from '../../assessment/application/grading-context.service.js';
import { ReportCardDocumentBuilder } from '../../assessment/application/report-card-document.builder.js';
import {
  InMemoryReportCardRepository,
  InMemoryStudentGradeRepository,
} from '../../assessment/testing/in-memory-assessment.repositories.js';
import { AttendanceViewAssembler } from '../../attendance/application/attendance-view.assembler.js';
import { ClassSessionService } from '../../attendance/application/class-session.service.js';
import { InMemoryAttendanceRecordRepository } from '../../attendance/testing/in-memory-attendance-record.repository.js';
import { AcademicPeriod } from '../../calendar/domain/academic-period.js';
import { InMemoryAcademicPeriodRepository } from '../../calendar/testing/in-memory-academic-period.repository.js';
import { AcademicAccessService } from '../../structure/application/academic-access.service.js';
import { ClassroomOverviewService } from '../../structure/application/classroom-overview.service.js';
import { Classroom } from '../../structure/domain/classroom.js';
import { Grade } from '../../structure/domain/grade.js';
import { GroupDirectorship } from '../../structure/domain/group-directorship.js';
import { Subject } from '../../structure/domain/subject.js';
import { TeachingAssignment } from '../../structure/domain/teaching-assignment.js';
import { InMemoryStructure } from '../../structure/testing/in-memory-structure.repositories.js';
import { anActor } from './actors.js';
import {
  aStaffMember,
  aStudent,
  FakeAcademicSettings,
  FakeStaffDirectory,
  FakeStudentDirectory,
} from './fake-directories.js';

/** User ids of the seeded actors. */
export const USERS = { admin: 1, teacher: 10, otherTeacher: 11, student: 20, parent: 30, outsider: 40 } as const;

/**
 * In-memory academic context wired like the Nest module, plus a seeded school:
 * grade "Quinto" with Matemáticas and Español, classroom 5A (2026) directed by
 * the teacher, two active students and an open first period.
 * The clock is frozen on 2026-03-15 10:00 (school time).
 */
export class AcademicWorld {
  readonly structure = new InMemoryStructure();
  readonly periods = new InMemoryAcademicPeriodRepository();
  readonly grades = new InMemoryStudentGradeRepository();
  readonly reportCards = new InMemoryReportCardRepository();
  readonly attendance = new InMemoryAttendanceRecordRepository();
  readonly students = new FakeStudentDirectory();
  readonly staff = new FakeStaffDirectory();
  readonly settings = new FakeAcademicSettings(2026);
  readonly clock = new FixedClock();
  readonly uow = new FakeUnitOfWork();
  readonly events = new RecordingEventBus();

  readonly access = new AcademicAccessService(
    this.staff,
    this.students,
    this.structure.directorships,
    this.structure.assignments,
    this.structure.classrooms,
  );
  readonly overview = new ClassroomOverviewService(
    this.structure.grades,
    this.structure.directorships,
    this.students,
    this.staff,
  );
  readonly gradeLines = new GradeLinesService(this.structure.subjects, this.structure.assignments, this.staff);
  readonly reportCardBuilder = new ReportCardDocumentBuilder(
    this.settings,
    this.grades,
    this.structure.classrooms,
    this.structure.grades,
    this.structure.directorships,
    this.staff,
    this.attendance,
    this.gradeLines,
  );
  readonly gradingContext = new GradingContextService(
    this.structure.classrooms,
    this.structure.subjects,
    this.structure.assignments,
    this.periods,
    this.access,
  );
  readonly classSessions = new ClassSessionService(this.structure.classrooms, this.structure.assignments, this.access);
  readonly attendanceViews = new AttendanceViewAssembler(
    this.students,
    this.staff,
    this.structure.classrooms,
    this.structure.subjects,
  );

  readonly teacher = aStaffMember({ id: 501, firstName: 'Laura', lastName: 'Gómez' });
  readonly otherTeacher = aStaffMember({ id: 502, firstName: 'Pedro', lastName: 'Díaz' });
  readonly grade = Grade.create({ name: 'Quinto', level: 'primaria' });
  readonly math = Subject.create(1, { name: 'Matemáticas', code: 'mat', area: 'Ciencias', hoursPerWeek: 5 });
  readonly spanish = Subject.create(1, { name: 'Español', area: 'Humanidades', hoursPerWeek: 4 });
  readonly classroom = Classroom.create({ gradeId: 1, name: '5A', academicYear: 2026 });
  readonly firstPeriod = AcademicPeriod.create({
    name: 'Primer Período',
    academicYear: 2026,
    startDate: '2026-02-01',
    endDate: '2026-04-15',
    open: true,
  });
  readonly ana = aStudent({
    id: 1001,
    firstName: 'Ana',
    lastName: 'Pérez',
    documentNumber: '1101814264',
    classroomId: 1,
  });
  readonly bruno = aStudent({
    id: 1002,
    firstName: 'Bruno',
    lastName: 'Arias',
    documentNumber: '1101814265',
    gender: 'M',
    classroomId: 1,
  });

  readonly actors = {
    admin: anActor(Role.ADMIN, USERS.admin),
    teacher: anActor(Role.TEACHER, USERS.teacher),
    otherTeacher: anActor(Role.TEACHER, USERS.otherTeacher),
    student: anActor(Role.STUDENT, USERS.student),
    parent: anActor(Role.PARENT, USERS.parent),
    outsider: anActor(Role.PARENT, USERS.outsider),
  };

  /** Seeds the school described in the class comment. */
  async seed(): Promise<this> {
    await this.structure.grades.save(this.grade);
    await this.structure.subjects.save(this.math);
    await this.structure.subjects.save(this.spanish);
    await this.structure.classrooms.save(this.classroom);
    this.staff.add(this.teacher, USERS.teacher).add(this.otherTeacher, USERS.otherTeacher);
    await this.structure.assignments.save(
      TeachingAssignment.create({ employeeId: this.teacher.id, subject: this.math, classroom: this.classroom }),
    );
    await this.structure.assignments.save(
      TeachingAssignment.create({ employeeId: this.otherTeacher.id, subject: this.spanish, classroom: this.classroom }),
    );
    await this.structure.directorships.save(GroupDirectorship.start(1, this.teacher.id, '2026-01-20'));
    this.students.add(this.ana, this.bruno).link(USERS.student, this.ana.id).link(USERS.parent, this.ana.id);
    await this.periods.save(this.firstPeriod);
    return this;
  }
}
