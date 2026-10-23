import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CreateGuardianUseCase } from '../../application/create-guardian.use-case.js';
import { FindGuardianByDocumentUseCase } from '../../application/find-guardian-by-document.use-case.js';
import { GetGuardianUseCase } from '../../application/get-guardian.use-case.js';
import { UpdateGuardianUseCase } from '../../application/update-guardian.use-case.js';
import { FindGuardianQueryDto, GuardianDetailsDto } from './dto/guardian.dto.js';

/** Legal guardians, shared between siblings. Admin only. */
@ApiTags('Acudientes')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('guardians')
export class GuardiansController {
  constructor(
    private readonly findByDocument: FindGuardianByDocumentUseCase,
    private readonly getGuardian: GetGuardianUseCase,
    private readonly createGuardian: CreateGuardianUseCase,
    private readonly updateGuardian: UpdateGuardianUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Busca un acudiente por número de documento (reutilización entre hermanos)',
  })
  find(@Query() query: FindGuardianQueryDto) {
    return this.findByDocument.execute(query.documentNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Acudiente con sus estudiantes vinculados' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.getGuardian.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Registra un acudiente' })
  create(@Body() dto: GuardianDetailsDto) {
    return this.createGuardian.execute(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualiza un acudiente (afecta a todos sus estudiantes)',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: GuardianDetailsDto) {
    return this.updateGuardian.execute({ guardianId: id, details: dto });
  }
}
