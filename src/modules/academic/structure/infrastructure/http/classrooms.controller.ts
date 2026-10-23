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
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../../shared/domain/role.js';
import { Roles } from '../../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { AcademicYearQueryDto } from '../../../common/infrastructure/http/academic-query.dto.js';
import { AssignGroupDirectorUseCase } from '../../application/assign-group-director.use-case.js';
import { AssignTeacherUseCase } from '../../application/assign-teacher.use-case.js';
import { ChangeAssignmentTeacherUseCase } from '../../application/change-assignment-teacher.use-case.js';
import { CreateClassroomUseCase } from '../../application/create-classroom.use-case.js';
import { DeleteClassroomUseCase } from '../../application/delete-classroom.use-case.js';
import { ListClassroomAssignmentsUseCase } from '../../application/list-classroom-assignments.use-case.js';
import { ListClassroomsUseCase } from '../../application/list-classrooms.use-case.js';
import { RemoveAssignmentUseCase } from '../../application/remove-assignment.use-case.js';
import { UpdateClassroomUseCase } from '../../application/update-classroom.use-case.js';
import {
  AssignDirectorDto,
  ChangeAssignmentTeacherDto,
  CreateAssignmentDto,
  CreateClassroomDto,
  UpdateClassroomDto,
} from './dto/structure.dto.js';

/** Classrooms, group directors and teaching load (legacy `academic/index.php`, `academic/assignments.php`). */
@ApiTags('Académico · Salones y carga docente')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('academic')
export class ClassroomsController {
  constructor(
    private readonly listClassrooms: ListClassroomsUseCase,
    private readonly createClassroom: CreateClassroomUseCase,
    private readonly updateClassroom: UpdateClassroomUseCase,
    private readonly deleteClassroom: DeleteClassroomUseCase,
    private readonly assignDirector: AssignGroupDirectorUseCase,
    private readonly teachingLoad: ListClassroomAssignmentsUseCase,
    private readonly assignTeacher: AssignTeacherUseCase,
    private readonly changeTeacher: ChangeAssignmentTeacherUseCase,
    private readonly removeAssignment: RemoveAssignmentUseCase,
  ) {}

  @Get('classrooms')
  @ApiOperation({ summary: 'Salones del año lectivo con director y número de estudiantes' })
  list(@Query() query: AcademicYearQueryDto) {
    return this.listClassrooms.execute({ year: query.year });
  }

  @Post('classrooms')
  @ApiOperation({ summary: 'Crea un salón' })
  create(@Body() dto: CreateClassroomDto) {
    return this.createClassroom.execute(dto);
  }

  @Patch('classrooms/:classroomId')
  @ApiOperation({ summary: 'Edita un salón' })
  update(@Param('classroomId', ParseIntPipe) classroomId: number, @Body() dto: UpdateClassroomDto) {
    return this.updateClassroom.execute({ classroomId, ...dto });
  }

  @Delete('classrooms/:classroomId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un salón sin estudiantes activos ni carga académica' })
  async remove(@Param('classroomId', ParseIntPipe) classroomId: number): Promise<void> {
    await this.deleteClassroom.execute(classroomId);
  }

  @Put('classrooms/:classroomId/director')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Asigna o quita (employeeId = null) el director de grupo' })
  async director(
    @Param('classroomId', ParseIntPipe) classroomId: number,
    @Body() dto: AssignDirectorDto,
  ): Promise<void> {
    await this.assignDirector.execute({ classroomId, employeeId: dto.employeeId });
  }

  @Get('classrooms/:classroomId/assignments')
  @ApiOperation({ summary: 'Carga académica del salón: materias del grado con su docente' })
  assignments(@Param('classroomId', ParseIntPipe) classroomId: number) {
    return this.teachingLoad.execute(classroomId);
  }

  @Post('assignments')
  @ApiOperation({ summary: 'Asigna un docente a una materia del salón' })
  assign(@Body() dto: CreateAssignmentDto) {
    return this.assignTeacher.execute(dto);
  }

  @Patch('assignments/:assignmentId')
  @ApiOperation({ summary: 'Cambia el docente de una asignación' })
  reassign(@Param('assignmentId', ParseIntPipe) assignmentId: number, @Body() dto: ChangeAssignmentTeacherDto) {
    return this.changeTeacher.execute({ assignmentId, employeeId: dto.employeeId });
  }

  @Delete('assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quita una asignación docente' })
  async unassign(@Param('assignmentId', ParseIntPipe) assignmentId: number): Promise<void> {
    await this.removeAssignment.execute(assignmentId);
  }
}
