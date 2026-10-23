import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetAdminDashboardUseCase } from '../../application/get-admin-dashboard.use-case.js';
import { AdminDashboardResponseDto } from './dto/admin-dashboard.dto.js';

/** KPIs of the back-office home page. */
@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly adminDashboard: GetAdminDashboardUseCase) {}

  @Get('admin')
  @Roles(Role.ADMIN, Role.FINANCE, Role.HR)
  @ApiOperation({ summary: 'KPIs del panel principal; los widgets dependen del rol' })
  @ApiOkResponse({ type: AdminDashboardResponseDto })
  admin(@CurrentActor() actor: AuthenticatedActor) {
    return this.adminDashboard.execute(actor.role);
  }
}
