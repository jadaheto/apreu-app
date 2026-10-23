import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetTestSetProgressUseCase } from '../../application/get-test-set-progress.use-case.js';
import { ResetHabilitationNumberingUseCase } from '../../application/reset-habilitation-numbering.use-case.js';
import { RunHabilitationTestSetUseCase } from '../../application/run-habilitation-test-set.use-case.js';
import { ResetNumberingDto, TestSetPlanDto } from './dto/documents.dto.js';

/** DIAN habilitation: test set and numbering reset (legacy `finance/dian_tests.php`, `reset_consecutives.php`). */
@ApiTags('Facturación electrónica · Habilitación')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('e-invoicing/habilitation')
export class HabilitationController {
  constructor(
    private readonly runTestSet: RunHabilitationTestSetUseCase,
    private readonly progress: GetTestSetProgressUseCase,
    private readonly resetNumbering: ResetHabilitationNumberingUseCase,
  ) {}

  @Post('test-set/run')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Genera y envía el set de pruebas en segundo plano' })
  run(@Body() dto: TestSetPlanDto) {
    return this.runTestSet.execute(dto);
  }

  @Get('test-set/progress')
  @Roles(Role.ADMIN, Role.FINANCE)
  @ApiOperation({ summary: 'Avance del set de pruebas por tipo y estado' })
  showProgress() {
    return this.progress.execute();
  }

  @Post('numbering/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reinicia la numeración de habilitación sin borrar documentos' })
  reset(@Body() dto: ResetNumberingDto) {
    return this.resetNumbering.execute(dto.types);
  }
}
