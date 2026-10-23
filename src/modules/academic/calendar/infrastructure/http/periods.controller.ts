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
import { ClosePeriodUseCase } from '../../application/close-period.use-case.js';
import { CreatePeriodUseCase } from '../../application/create-period.use-case.js';
import { DeletePeriodUseCase } from '../../application/delete-period.use-case.js';
import { ListPeriodsUseCase } from '../../application/list-periods.use-case.js';
import { ReopenPeriodUseCase } from '../../application/reopen-period.use-case.js';
import { UpdatePeriodUseCase } from '../../application/update-period.use-case.js';
import { CreateAcademicPeriodDto, UpdatePeriodDto } from './dto/period.dto.js';

/** Academic calendar (legacy `academic/periods.php`). */
@ApiTags('Académico · Períodos')
@ApiBearerAuth()
@Controller('academic/periods')
export class PeriodsController {
  constructor(
    private readonly listPeriods: ListPeriodsUseCase,
    private readonly createPeriod: CreatePeriodUseCase,
    private readonly updatePeriod: UpdatePeriodUseCase,
    private readonly deletePeriod: DeletePeriodUseCase,
    private readonly closePeriod: ClosePeriodUseCase,
    private readonly reopenPeriod: ReopenPeriodUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Períodos del año lectivo (cualquier usuario autenticado)' })
  list(@Query() query: AcademicYearQueryDto) {
    return this.listPeriods.execute({ year: query.year });
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crea un período (abierto solo si no hay otro abierto en el año)' })
  create(@Body() dto: CreateAcademicPeriodDto) {
    return this.createPeriod.execute(dto);
  }

  @Patch(':periodId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Renombra o cambia las fechas de un período' })
  update(@Param('periodId', ParseIntPipe) periodId: number, @Body() dto: UpdatePeriodDto) {
    return this.updatePeriod.execute({ periodId, ...dto });
  }

  @Delete(':periodId')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un período sin calificaciones' })
  async remove(@Param('periodId', ParseIntPipe) periodId: number): Promise<void> {
    await this.deletePeriod.execute(periodId);
  }

  @Post(':periodId/close')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cierra el período: los docentes ya no pueden calificar' })
  close(@Param('periodId', ParseIntPipe) periodId: number) {
    return this.closePeriod.execute(periodId);
  }

  @Post(':periodId/reopen')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reabre un período cerrado (cierra el que esté abierto en el año)' })
  reopen(@Param('periodId', ParseIntPipe) periodId: number) {
    return this.reopenPeriod.execute(periodId);
  }
}
