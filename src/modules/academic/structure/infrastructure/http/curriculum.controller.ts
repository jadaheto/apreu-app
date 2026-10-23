import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../../shared/domain/role.js';
import { Roles } from '../../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { AcademicYearQueryDto } from '../../../common/infrastructure/http/academic-query.dto.js';
import { AddSubjectUseCase } from '../../application/add-subject.use-case.js';
import { CreateGradeUseCase } from '../../application/create-grade.use-case.js';
import { DeleteGradeUseCase } from '../../application/delete-grade.use-case.js';
import { GetAcademicDashboardUseCase } from '../../application/get-academic-dashboard.use-case.js';
import { ListGradeSubjectsUseCase } from '../../application/list-grade-subjects.use-case.js';
import { ListGradesUseCase } from '../../application/list-grades.use-case.js';
import { ListTeachingStaffUseCase } from '../../application/list-teaching-staff.use-case.js';
import { RemoveSubjectUseCase } from '../../application/remove-subject.use-case.js';
import { UpdateGradeUseCase } from '../../application/update-grade.use-case.js';
import { UpdateSubjectUseCase } from '../../application/update-subject.use-case.js';
import { GradeDto, SubjectDto } from './dto/structure.dto.js';

/** Grades, curriculum and the academic dashboard (legacy `academic/index.php`, `academic/subjects.php`). */
@ApiTags('Académico · Estructura')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('academic')
export class CurriculumController {
  constructor(
    private readonly dashboard: GetAcademicDashboardUseCase,
    private readonly listGrades: ListGradesUseCase,
    private readonly createGrade: CreateGradeUseCase,
    private readonly updateGrade: UpdateGradeUseCase,
    private readonly deleteGrade: DeleteGradeUseCase,
    private readonly listSubjects: ListGradeSubjectsUseCase,
    private readonly addSubject: AddSubjectUseCase,
    private readonly updateSubject: UpdateSubjectUseCase,
    private readonly removeSubject: RemoveSubjectUseCase,
    private readonly teachingStaff: ListTeachingStaffUseCase,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'KPIs, grados y salones del año lectivo' })
  getDashboard(@Query() query: AcademicYearQueryDto) {
    return this.dashboard.execute({ year: query.year });
  }

  @Get('grades')
  @ApiOperation({ summary: 'Catálogo de grados' })
  grades() {
    return this.listGrades.execute();
  }

  @Post('grades')
  @ApiOperation({ summary: 'Crea un grado' })
  create(@Body() dto: GradeDto) {
    return this.createGrade.execute(dto);
  }

  @Patch('grades/:gradeId')
  @ApiOperation({ summary: 'Edita un grado' })
  update(@Param('gradeId', ParseIntPipe) gradeId: number, @Body() dto: GradeDto) {
    return this.updateGrade.execute({ gradeId, ...dto });
  }

  @Delete('grades/:gradeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un grado sin salones ni materias' })
  async remove(@Param('gradeId', ParseIntPipe) gradeId: number): Promise<void> {
    await this.deleteGrade.execute(gradeId);
  }

  @Get('grades/:gradeId/subjects')
  @ApiOperation({ summary: 'Plan de estudios del grado' })
  subjects(@Param('gradeId', ParseIntPipe) gradeId: number) {
    return this.listSubjects.execute(gradeId);
  }

  @Post('grades/:gradeId/subjects')
  @ApiOperation({ summary: 'Agrega una materia al plan de estudios' })
  createSubject(@Param('gradeId', ParseIntPipe) gradeId: number, @Body() dto: SubjectDto) {
    return this.addSubject.execute({ gradeId, ...dto });
  }

  @Patch('subjects/:subjectId')
  @ApiOperation({ summary: 'Edita una materia' })
  editSubject(@Param('subjectId', ParseIntPipe) subjectId: number, @Body() dto: SubjectDto) {
    return this.updateSubject.execute({ subjectId, ...dto });
  }

  @Delete('subjects/:subjectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una materia sin notas ni docentes asignados' })
  async deleteSubject(@Param('subjectId', ParseIntPipe) subjectId: number): Promise<void> {
    await this.removeSubject.execute(subjectId);
  }

  @Get('teachers')
  @ApiOperation({ summary: 'Docentes y directivos activos elegibles para carga académica y dirección de grupo' })
  teachers() {
    return this.teachingStaff.execute();
  }
}
