import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ListMyStudentsUseCase } from '../../application/list-my-students.use-case.js';

@ApiTags('Finanzas · Portal estudiante/acudiente')
@ApiBearerAuth()
@Roles(Role.STUDENT, Role.PARENT)
@Controller('finance/portal')
export class PortalController {
  constructor(private readonly myStudents: ListMyStudentsUseCase) {}

  @Get('students')
  @ApiOperation({ summary: 'Estudiantes vinculados al usuario (selector de hijo)' })
  students(@CurrentActor() actor: AuthenticatedActor) {
    return this.myStudents.execute(actor);
  }
}
