import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetTuitionScheduleUseCase } from '../../application/get-tuition-schedule.use-case.js';
import { SaveTuitionScheduleUseCase } from '../../application/save-tuition-schedule.use-case.js';
import { SaveTuitionScheduleDto, TuitionQueryDto } from './dto/tuition.dto.js';
import { FINANCE_ADMIN, FINANCE_STAFF } from './finance-roles.js';

@ApiTags('Finanzas · Tarifas por grado')
@ApiBearerAuth()
@Controller('finance/tuition')
export class TuitionController {
  constructor(
    private readonly getSchedule: GetTuitionScheduleUseCase,
    private readonly saveSchedule: SaveTuitionScheduleUseCase,
  ) {}

  @Get()
  @Roles(...FINANCE_STAFF)
  @ApiOperation({ summary: 'Tarifas por grado de un año académico' })
  get(@Query() query: TuitionQueryDto) {
    return this.getSchedule.execute({ year: query.year });
  }

  @Put(':year')
  @Roles(...FINANCE_ADMIN)
  @ApiOperation({ summary: 'Reemplaza las tarifas por grado del año' })
  save(@Param('year', ParseIntPipe) year: number, @Body() dto: SaveTuitionScheduleDto) {
    return this.saveSchedule.execute({
      academicYear: year,
      rates: dto.rates.map((rate) => ({
        gradeId: rate.gradeId,
        conceptId: rate.conceptId ?? null,
        amount: rate.amount,
      })),
    });
  }
}
