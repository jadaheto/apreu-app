import { Role } from '../../../../shared/domain/role.js';
import { anActor } from '../../common/testing/actors.js';
import { AcademicWorld } from '../../common/testing/academic-world.js';
import { aStudent } from '../../common/testing/fake-directories.js';
import { AttendanceRecord } from '../domain/attendance-record.js';
import { aSignedQr, FakeStudentQrVerifier } from '../testing/fake-student-qr.js';
import { GetDailyAttendanceReportUseCase } from './get-daily-attendance-report.use-case.js';
import { GetStudentAttendanceUseCase } from './get-student-attendance.use-case.js';
import {
  RegisterManualAttendanceUseCase,
  type RegisterManualAttendanceInput,
} from './register-manual-attendance.use-case.js';
import { RegisterQrAttendanceUseCase } from './register-qr-attendance.use-case.js';

describe('attendance use cases', () => {
  let w: AcademicWorld;
  const qr = () =>
    new RegisterQrAttendanceUseCase(w.classSessions, w.students, w.attendance, new FakeStudentQrVerifier(), w.clock);
  const manual = () => new RegisterManualAttendanceUseCase(w.classSessions, w.students, w.attendance, w.uow, w.clock);
  const scan = (rawQr: string, actor = w.actors.teacher) =>
    qr().execute({ actor, rawQr, subjectId: 1, classroomId: 1 });

  beforeEach(async () => {
    w = await new AcademicWorld().seed();
  });

  describe('RegisterQrAttendanceUseCase', () => {
    it('registers the student as present with the teacher from the token (S1)', async () => {
      const result = await scan(aSignedQr(1001));
      expect(result).toMatchObject({
        student: { id: 1001, firstName: 'Ana', lastName: 'Pérez', documentNumber: '1101814264' },
        date: '2026-03-15',
        time: '10:00:00',
      });
      expect(w.attendance.store.all()[0]).toMatchObject({ employeeId: 501, status: 'present', source: 'qr' });
    });

    it('rejects a second scan of the same class on the same day', async () => {
      await scan(aSignedQr(1001));
      await expect(scan(aSignedQr(1001))).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it.each([
      ['a forged signature', 'APREU1|colegio-a|1001|2026|forgedsignature00000'],
      ['a card of another school', aSignedQr(1001, 2026, 'colegio-b')],
    ])('rejects %s (S13)', async (_case, raw) => {
      await expect(scan(raw)).rejects.toMatchObject({ code: 'QR_NOT_AUTHENTIC' });
    });

    it('rejects the legacy unsigned card', async () => {
      await expect(scan('20261101814264primariaT')).rejects.toMatchObject({ code: 'INVALID_QR' });
    });

    it('rejects cards of another year or of students outside the classroom', async () => {
      await expect(scan(aSignedQr(1001, 2025))).rejects.toMatchObject({ code: 'QR_WRONG_YEAR' });
      w.students.add(aStudent({ id: 3001, classroomId: 2 }), aStudent({ id: 3002, classroomId: 1, isActive: false }));
      await expect(scan(aSignedQr(3001))).rejects.toMatchObject({ code: 'QR_STUDENT_NOT_IN_CLASSROOM' });
      await expect(scan(aSignedQr(3002))).rejects.toMatchObject({ code: 'QR_STUDENT_NOT_IN_CLASSROOM' });
      await expect(scan(aSignedQr(9999))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('requires the teacher to be assigned and linked to an employee', async () => {
      await expect(scan(aSignedQr(1001), w.actors.otherTeacher)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(scan(aSignedQr(1001), anActor(Role.ADMIN, 77))).rejects.toMatchObject({ code: 'FORBIDDEN' });
      w.staff.add(w.staff.members.get(502)!, 77);
      await expect(scan(aSignedQr(1001), anActor(Role.ADMIN, 77))).resolves.toMatchObject({ student: { id: 1001 } });
    });
  });

  describe('RegisterManualAttendanceUseCase', () => {
    const input = (overrides: Partial<RegisterManualAttendanceInput> = {}): RegisterManualAttendanceInput => ({
      actor: w.actors.teacher,
      classroomId: 1,
      subjectId: 1,
      entries: [
        { studentId: 1001, status: 'present' },
        { studentId: 1002, status: 'absent' },
      ],
      ...overrides,
    });

    it('records every status and corrects existing QR records (B22)', async () => {
      await scan(aSignedQr(1001));
      await expect(
        manual().execute(
          input({
            entries: [
              { studentId: 1001, status: 'late' },
              { studentId: 1002, status: 'absent' },
            ],
          }),
        ),
      ).resolves.toEqual({ saved: 2 });
      expect(w.attendance.store.all().map((r) => [r.studentId, r.status, r.source])).toEqual([
        [1001, 'late', 'manual'],
        [1002, 'absent', 'manual'],
      ]);
    });

    it('accepts past dates but not future ones', async () => {
      await manual().execute(input({ date: '2026-03-10' }));
      expect(w.attendance.store.all()[0].date).toBe('2026-03-10');
      await expect(manual().execute(input({ date: '2026-03-16' }))).rejects.toMatchObject({ code: 'FUTURE_DATE' });
    });

    it('validates the roster', async () => {
      await expect(
        manual().execute(input({ entries: [{ studentId: 5555, status: 'present' }] })),
      ).rejects.toMatchObject({
        code: 'STUDENT_NOT_IN_CLASSROOM',
      });
      await expect(
        manual().execute(
          input({
            entries: [
              { studentId: 1001, status: 'present' },
              { studentId: 1001, status: 'absent' },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: 'DUPLICATED_STUDENT' });
    });
  });

  describe('reports', () => {
    beforeEach(async () => {
      await scan(aSignedQr(1001));
      await manual().execute({
        actor: w.actors.teacher,
        classroomId: 1,
        subjectId: 1,
        entries: [{ studentId: 1002, status: 'absent' }],
      });
      await w.attendance.save(
        AttendanceRecord.register({
          studentId: 1001,
          employeeId: 502,
          subjectId: 2,
          classroomId: 1,
          date: '2026-03-02',
          time: '08:00:00',
          status: 'late',
          source: 'manual',
        }),
      );
    });

    it('builds the daily report with totals per status', async () => {
      const report = await new GetDailyAttendanceReportUseCase(w.attendance, w.clock, w.attendanceViews).execute({
        page: { page: 1, limit: 20 },
      });
      expect(report.date).toBe('2026-03-15');
      expect(report.totals).toEqual({ present: 1, absent: 1, late: 0, excused: 0 });
      expect(report.records.total).toBe(2);
      expect(report.records.items[0]).toMatchObject({
        classroomName: '5A',
        subjectName: 'Matemáticas',
        teacherName: 'Laura Gómez',
      });
      const filtered = await new GetDailyAttendanceReportUseCase(w.attendance, w.clock, w.attendanceViews).execute({
        date: '2026-03-02',
        classroomId: 1,
        page: { page: 1, limit: 20 },
      });
      expect(filtered.totals.late).toBe(1);
    });

    it('summarizes a student month by real status', async () => {
      const view = await new GetStudentAttendanceUseCase(w.access, w.attendance, w.clock, w.attendanceViews).execute({
        actor: w.actors.parent,
        studentId: 1001,
      });
      expect(view.month).toBe('2026-03');
      expect(view.summary).toEqual({ present: 1, absent: 0, late: 1, excused: 0, daysAttended: 2, totalRecords: 2 });
      expect(view.recent.map((r) => r.date)).toEqual(['2026-03-15', '2026-03-02']);
      const february = await new GetStudentAttendanceUseCase(
        w.access,
        w.attendance,
        w.clock,
        w.attendanceViews,
      ).execute({
        actor: w.actors.admin,
        studentId: 1001,
        month: '2026-02',
      });
      expect(february.summary.totalRecords).toBe(0);
      await expect(
        new GetStudentAttendanceUseCase(w.access, w.attendance, w.clock, w.attendanceViews).execute({
          actor: w.actors.student,
          studentId: 1002,
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });
  });
});
