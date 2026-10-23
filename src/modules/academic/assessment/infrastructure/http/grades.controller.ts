import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetGradeSheetUseCase } from '../../application/get-grade-sheet.use-case.js';
import { GetStudentGradesUseCase } from '../../application/get-student-grades.use-case.js';
import { SaveGradeSheetUseCase } from '../../application/save-grade-sheet.use-case.js';
import { GradeSheetQueryDto, PeriodQueryDto, SaveGradeSheetDto } from './dto/assessment.dto.js';

/** Grade sheets and student grades (legacy `academic/grades_entry.php`, `student/mis_notas.php`). */
@ApiTags('Académico · Calificaciones')
@ApiBearerAuth()
@Controller('academic')
export class GradesController {
  constructor(
    private readonly gradeSheet: GetGradeSheetUseCase,
    private readonly saveGradeSheet: SaveGradeSheetUseCase,
    private readonly studentGrades: GetStudentGradesUseCase,
  ) {}

  @Get('grade-sheets')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Planilla de notas de un salón/materia/período (docente: solo sus asignaciones)' })
  sheet(@CurrentActor() actor: AuthenticatedActor, @Query() query: GradeSheetQueryDto) {
    return this.gradeSheet.execute({ actor, ...query });
  }

  @Put('grade-sheets')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Guarda la planilla en el período abierto (definitiva 60/30/10, escala 0–5)' })
  save(@CurrentActor() actor: AuthenticatedActor, @Body() dto: SaveGradeSheetDto) {
    return this.saveGradeSheet.execute({ actor, ...dto });
  }

  @Get('students/:studentId/grades')
  @ApiOperation({
    summary: 'Notas de un estudiante por período',
    description: 'Admin, el propio estudiante, sus acudientes, el director de grupo y los docentes del salón.',
  })
  grades(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: PeriodQueryDto,
  ) {
    return this.studentGrades.execute({ actor, studentId, periodId: query.periodId });
  }
}
