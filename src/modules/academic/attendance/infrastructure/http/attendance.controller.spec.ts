import { Role } from '../../../../../shared/domain/role.js';
import { anActor } from '../../../common/testing/actors.js';
import { buildController } from '../../../common/testing/controller-harness.js';
import { GetDailyAttendanceReportUseCase } from '../../application/get-daily-attendance-report.use-case.js';
import { GetStudentAttendanceUseCase } from '../../application/get-student-attendance.use-case.js';
import { RegisterManualAttendanceUseCase } from '../../application/register-manual-attendance.use-case.js';
import { RegisterQrAttendanceUseCase } from '../../application/register-qr-attendance.use-case.js';
import { DailyAttendanceQueryDto } from './dto/attendance.dto.js';
import { AttendanceController } from './attendance.controller.js';

describe('AttendanceController', () => {
  it('delegates each endpoint with the actor from the token', async () => {
    const actor = anActor(Role.TEACHER, 10);
    const { controller: c, mocks } = await buildController(AttendanceController, [
      RegisterQrAttendanceUseCase,
      RegisterManualAttendanceUseCase,
      GetDailyAttendanceReportUseCase,
      GetStudentAttendanceUseCase,
    ]);

    await c.qr(actor, { rawQr: 'APREU1|x|1|2026|sig', subjectId: 1, classroomId: 2 });
    expect(mocks.get(RegisterQrAttendanceUseCase)!.execute).toHaveBeenCalledWith({
      actor,
      rawQr: 'APREU1|x|1|2026|sig',
      subjectId: 1,
      classroomId: 2,
    });
    const manual = { classroomId: 2, subjectId: 1, entries: [{ studentId: 3, status: 'absent' as const }] };
    await c.manual(actor, manual);
    expect(mocks.get(RegisterManualAttendanceUseCase)!.execute).toHaveBeenCalledWith({ actor, ...manual });

    const query = Object.assign(new DailyAttendanceQueryDto(), {
      date: '2026-03-15',
      classroomId: 2,
      page: 2,
      limit: 10,
    });
    await c.report(query);
    expect(mocks.get(GetDailyAttendanceReportUseCase)!.execute).toHaveBeenCalledWith({
      date: '2026-03-15',
      classroomId: 2,
      page: { page: 2, limit: 10 },
    });
    await c.student(actor, 3, { month: '2026-03' });
    expect(mocks.get(GetStudentAttendanceUseCase)!.execute).toHaveBeenCalledWith({
      actor,
      studentId: 3,
      month: '2026-03',
    });
  });
});
