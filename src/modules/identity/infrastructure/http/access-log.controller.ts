import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ListAccessLogUseCase } from '../../application/list-access-log.use-case.js';
import { AccessLogQueryDto, PaginatedAccessLogResponseDto } from './dto/access-log.dto.js';

/** Access audit trail (`access_log`). Superadmin and admin only. */
@ApiTags('Auditoría')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('audit/access-log')
export class AccessLogController {
  constructor(private readonly listAccessLog: ListAccessLogUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Consulta paginada del registro de accesos' })
  @ApiOkResponse({ type: PaginatedAccessLogResponseDto })
  list(@Query() query: AccessLogQueryDto) {
    return this.listAccessLog.execute({
      criteria: {
        userId: query.userId,
        module: query.module,
        allowed: query.allowed,
        from: query.from,
        to: query.to,
        search: query.search,
      },
      page: query.toPageRequest(),
    });
  }
}
