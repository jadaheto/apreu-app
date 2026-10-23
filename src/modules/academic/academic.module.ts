import { Module } from '@nestjs/common';
import { DownloadGroupReportCardsUseCase } from './assessment/application/download-group-report-cards.use-case.js';
import { DownloadReportCardPdfUseCase } from './assessment/application/download-report-card-pdf.use-case.js';
import { GenerateReportCardsUseCase } from './assessment/application/generate-report-cards.use-case.js';
import { GetGradeSheetUseCase } from './assessment/application/get-grade-sheet.use-case.js';
import { GetGroupReportCardsUseCase } from './assessment/application/get-group-report-cards.use-case.js';
import { GetReportCardUseCase } from './assessment/application/get-report-card.use-case.js';
import { GetStudentGradesUseCase } from './assessment/application/get-student-grades.use-case.js';
import { GradeLinesService } from './assessment/application/grade-lines.service.js';
import { GradingContextService } from './assessment/application/grading-context.service.js';
import { ListStudentReportCardsUseCase } from './assessment/application/list-student-report-cards.use-case.js';
import { DOCUMENT_ARCHIVER } from './assessment/application/ports/document-archiver.port.js';
import { REPORT_CARD_RENDERER } from './assessment/application/ports/report-card-renderer.port.js';
import { ReportCardDocumentBuilder } from './assessment/application/report-card-document.builder.js';
import { SaveGradeSheetUseCase } from './assessment/application/save-grade-sheet.use-case.js';
import { REPORT_CARD_REPOSITORY, STUDENT_GRADE_REPOSITORY } from './assessment/domain/assessment.repositories.js';
import { PdfReportCardRenderer } from './assessment/infrastructure/adapters/pdf-report-card.renderer.js';
import { ZipDocumentArchiver } from './assessment/infrastructure/adapters/zip-document.archiver.js';
import { GradesController } from './assessment/infrastructure/http/grades.controller.js';
import { ReportCardsController } from './assessment/infrastructure/http/report-cards.controller.js';
import {
  TypeOrmReportCardRepository,
  TypeOrmStudentGradeRepository,
} from './assessment/infrastructure/persistence/index.js';
import { AttendanceViewAssembler } from './attendance/application/attendance-view.assembler.js';
import { ClassSessionService } from './attendance/application/class-session.service.js';
import { GetDailyAttendanceReportUseCase } from './attendance/application/get-daily-attendance-report.use-case.js';
import { GetStudentAttendanceUseCase } from './attendance/application/get-student-attendance.use-case.js';
import { RegisterManualAttendanceUseCase } from './attendance/application/register-manual-attendance.use-case.js';
import { STUDENT_QR_VERIFIER } from './attendance/application/ports/student-qr-verifier.port.js';
import { RegisterQrAttendanceUseCase } from './attendance/application/register-qr-attendance.use-case.js';
import { ATTENDANCE_RECORD_REPOSITORY } from './attendance/domain/attendance-record.repository.js';
import { HmacStudentQrVerifier } from './attendance/infrastructure/adapters/hmac-student-qr.verifier.js';
import { AttendanceController } from './attendance/infrastructure/http/attendance.controller.js';
import { TypeOrmAttendanceRecordRepository } from './attendance/infrastructure/persistence/index.js';
import { ClosePeriodUseCase } from './calendar/application/close-period.use-case.js';
import { CreatePeriodUseCase } from './calendar/application/create-period.use-case.js';
import { DeletePeriodUseCase } from './calendar/application/delete-period.use-case.js';
import { ListPeriodsUseCase } from './calendar/application/list-periods.use-case.js';
import { ReopenPeriodUseCase } from './calendar/application/reopen-period.use-case.js';
import { UpdatePeriodUseCase } from './calendar/application/update-period.use-case.js';
import { ACADEMIC_PERIOD_REPOSITORY } from './calendar/domain/academic-period.repository.js';
import { PeriodsController } from './calendar/infrastructure/http/periods.controller.js';
import { TypeOrmAcademicPeriodRepository } from './calendar/infrastructure/persistence/index.js';
import { ACADEMIC_SETTINGS } from './common/domain/academic-settings.port.js';
import { STAFF_DIRECTORY } from './common/domain/staff-directory.port.js';
import { STUDENT_DIRECTORY } from './common/domain/student-directory.port.js';
import { SqlAcademicSettings } from './common/infrastructure/sql-academic-settings.js';
import { SqlStaffDirectory } from './common/infrastructure/sql-staff-directory.js';
import { SqlStudentDirectory } from './common/infrastructure/sql-student-directory.js';
import { GetDirectorDashboardUseCase } from './portal/application/get-director-dashboard.use-case.js';
import { ListDirectedClassroomsUseCase } from './portal/application/list-directed-classrooms.use-case.js';
import { ListMyTeachingAssignmentsUseCase } from './portal/application/list-my-teaching-assignments.use-case.js';
import { TeacherPortalController } from './portal/infrastructure/http/teacher-portal.controller.js';
import { AcademicAccessService } from './structure/application/academic-access.service.js';
import { AddSubjectUseCase } from './structure/application/add-subject.use-case.js';
import { AssignGroupDirectorUseCase } from './structure/application/assign-group-director.use-case.js';
import { AssignTeacherUseCase } from './structure/application/assign-teacher.use-case.js';
import { ChangeAssignmentTeacherUseCase } from './structure/application/change-assignment-teacher.use-case.js';
import { ClassroomOverviewService } from './structure/application/classroom-overview.service.js';
import { CreateClassroomUseCase } from './structure/application/create-classroom.use-case.js';
import { CreateGradeUseCase } from './structure/application/create-grade.use-case.js';
import { DeleteClassroomUseCase } from './structure/application/delete-classroom.use-case.js';
import { DeleteGradeUseCase } from './structure/application/delete-grade.use-case.js';
import { GetAcademicDashboardUseCase } from './structure/application/get-academic-dashboard.use-case.js';
import { ListClassroomAssignmentsUseCase } from './structure/application/list-classroom-assignments.use-case.js';
import { ListClassroomsUseCase } from './structure/application/list-classrooms.use-case.js';
import { ListGradeSubjectsUseCase } from './structure/application/list-grade-subjects.use-case.js';
import { ListGradesUseCase } from './structure/application/list-grades.use-case.js';
import { ListTeachingStaffUseCase } from './structure/application/list-teaching-staff.use-case.js';
import { RemoveAssignmentUseCase } from './structure/application/remove-assignment.use-case.js';
import { RemoveSubjectUseCase } from './structure/application/remove-subject.use-case.js';
import { UpdateClassroomUseCase } from './structure/application/update-classroom.use-case.js';
import { UpdateGradeUseCase } from './structure/application/update-grade.use-case.js';
import { UpdateSubjectUseCase } from './structure/application/update-subject.use-case.js';
import {
  CLASSROOM_REPOSITORY,
  GRADE_REPOSITORY,
  GROUP_DIRECTORSHIP_REPOSITORY,
  SUBJECT_REPOSITORY,
  TEACHING_ASSIGNMENT_REPOSITORY,
} from './structure/domain/structure.repositories.js';
import { ClassroomsController } from './structure/infrastructure/http/classrooms.controller.js';
import { CurriculumController } from './structure/infrastructure/http/curriculum.controller.js';
import {
  TypeOrmClassroomRepository,
  TypeOrmGradeRepository,
  TypeOrmGroupDirectorshipRepository,
  TypeOrmSubjectRepository,
  TypeOrmTeachingAssignmentRepository,
} from './structure/infrastructure/persistence/index.js';

const structureUseCases = [
  GetAcademicDashboardUseCase,
  ListGradesUseCase,
  CreateGradeUseCase,
  UpdateGradeUseCase,
  DeleteGradeUseCase,
  ListGradeSubjectsUseCase,
  AddSubjectUseCase,
  UpdateSubjectUseCase,
  RemoveSubjectUseCase,
  ListClassroomsUseCase,
  CreateClassroomUseCase,
  UpdateClassroomUseCase,
  DeleteClassroomUseCase,
  AssignGroupDirectorUseCase,
  ListClassroomAssignmentsUseCase,
  AssignTeacherUseCase,
  ChangeAssignmentTeacherUseCase,
  RemoveAssignmentUseCase,
  ListTeachingStaffUseCase,
];

const calendarUseCases = [
  ListPeriodsUseCase,
  CreatePeriodUseCase,
  UpdatePeriodUseCase,
  DeletePeriodUseCase,
  ClosePeriodUseCase,
  ReopenPeriodUseCase,
];

const assessmentUseCases = [
  GetGradeSheetUseCase,
  SaveGradeSheetUseCase,
  GetStudentGradesUseCase,
  GenerateReportCardsUseCase,
  ListStudentReportCardsUseCase,
  GetReportCardUseCase,
  DownloadReportCardPdfUseCase,
  GetGroupReportCardsUseCase,
  DownloadGroupReportCardsUseCase,
];

const attendanceUseCases = [
  RegisterQrAttendanceUseCase,
  RegisterManualAttendanceUseCase,
  GetDailyAttendanceReportUseCase,
  GetStudentAttendanceUseCase,
];

const portalUseCases = [ListMyTeachingAssignmentsUseCase, ListDirectedClassroomsUseCase, GetDirectorDashboardUseCase];

/**
 * Academic context (analysis 02): academic structure, calendar, assessment,
 * attendance and the teacher/director portal. Composition root binding every
 * port to its adapter. Publishes `academic.period-closed` and
 * `academic.bulletins-generated`; subscribes to no event.
 */
@Module({
  controllers: [
    CurriculumController,
    ClassroomsController,
    PeriodsController,
    GradesController,
    ReportCardsController,
    AttendanceController,
    TeacherPortalController,
  ],
  providers: [
    ...structureUseCases,
    ...calendarUseCases,
    ...assessmentUseCases,
    ...attendanceUseCases,
    ...portalUseCases,
    AcademicAccessService,
    ClassroomOverviewService,
    GradingContextService,
    GradeLinesService,
    ReportCardDocumentBuilder,
    ClassSessionService,
    AttendanceViewAssembler,
    { provide: GRADE_REPOSITORY, useClass: TypeOrmGradeRepository },
    { provide: SUBJECT_REPOSITORY, useClass: TypeOrmSubjectRepository },
    { provide: CLASSROOM_REPOSITORY, useClass: TypeOrmClassroomRepository },
    { provide: TEACHING_ASSIGNMENT_REPOSITORY, useClass: TypeOrmTeachingAssignmentRepository },
    { provide: GROUP_DIRECTORSHIP_REPOSITORY, useClass: TypeOrmGroupDirectorshipRepository },
    { provide: ACADEMIC_PERIOD_REPOSITORY, useClass: TypeOrmAcademicPeriodRepository },
    { provide: STUDENT_GRADE_REPOSITORY, useClass: TypeOrmStudentGradeRepository },
    { provide: REPORT_CARD_REPOSITORY, useClass: TypeOrmReportCardRepository },
    { provide: ATTENDANCE_RECORD_REPOSITORY, useClass: TypeOrmAttendanceRecordRepository },
    { provide: STUDENT_DIRECTORY, useClass: SqlStudentDirectory },
    { provide: STAFF_DIRECTORY, useClass: SqlStaffDirectory },
    { provide: ACADEMIC_SETTINGS, useClass: SqlAcademicSettings },
    { provide: REPORT_CARD_RENDERER, useClass: PdfReportCardRenderer },
    { provide: DOCUMENT_ARCHIVER, useClass: ZipDocumentArchiver },
    { provide: STUDENT_QR_VERIFIER, useClass: HmacStudentQrVerifier },
  ],
})
export class AcademicModule {}
