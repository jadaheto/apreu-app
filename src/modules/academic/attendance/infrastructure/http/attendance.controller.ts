import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetDailyAttendanceReportUseCase } from '../../application/get-daily-attendance-report.use-case.js';
import { GetStudentAttendanceUseCase } from '../../application/get-student-attendance.use-case.js';
import { RegisterManualAttendanceUseCase } from '../../application/register-manual-attendance.use-case.js';
import { RegisterQrAttendanceUseCase } from '../../application/register-qr-attendance.use-case.js';
import {
  DailyAttendanceQueryDto,
  ManualAttendanceDto,
  AttendanceMonthQueryDto,
  QrAttendanceDto,
} from './dto/attendance.dto.js';

/** Attendance (legacy `api/register_attendance.php`, `academic/attendance.php`, `student/asistencia.php`). */
@ApiTags('Académico · Asistencia')
@ApiBearerAuth()
@Controller('academic')
export class AttendanceController {
  constructor(
    private readonly registerQr: RegisterQrAttendanceUseCase,
    private readonly registerManual: RegisterManualAttendanceUseCase,
    private readonly dailyReport: GetDailyAttendanceReportUseCase,
    private readonly studentAttendance: GetStudentAttendanceUseCase,
  ) {}

  @Post('attendance/qr')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Registra asistencia por QR del carnet; el docente se toma del token' })
  qr(@CurrentActor() actor: AuthenticatedActor, @Body() dto: QrAttendanceDto) {
    return this.registerQr.execute({ actor, ...dto });
  }

  @Post('attendance/manual')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Pase de lista manual (presente, ausente, tarde, excusado)' })
  manual(@CurrentActor() actor: AuthenticatedActor, @Body() dto: ManualAttendanceDto) {
    return this.registerManual.execute({ actor, ...dto });
  }

  @Get('attendance')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reporte de asistencia del día (opcionalmente por salón)' })
  report(@Query() query: DailyAttendanceQueryDto) {
    return this.dailyReport.execute({ date: query.date, classroomId: query.classroomId, page: query.toPageRequest() });
  }

  @Get('students/:studentId/attendance')
  @ApiOperation({ summary: 'Asistencia de un estudiante (admin, estudiante, acudiente, director de grupo)' })
  student(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: AttendanceMonthQueryDto,
  ) {
    return this.studentAttendance.execute({ actor, studentId, month: query.month });
  }
}
