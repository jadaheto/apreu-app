import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { DeletePostingRuleUseCase } from '../../application/delete-posting-rule.use-case.js';
import { ListPostingRulesUseCase } from '../../application/list-posting-rules.use-case.js';
import { SeedDefaultPostingRulesUseCase } from '../../application/seed-default-posting-rules.use-case.js';
import { SetPostingRuleUseCase } from '../../application/set-posting-rule.use-case.js';
import { ACCOUNTING_ROLES } from './accounting-roles.js';
import { SetPostingRuleDto } from './dto/posting-rule.dto.js';

@ApiTags('Contabilidad - Parametrización de asientos automáticos')
@ApiBearerAuth()
@Roles(...ACCOUNTING_ROLES)
@Controller('accounting/posting-rules')
export class PostingRulesController {
  constructor(
    private readonly listRules: ListPostingRulesUseCase,
    private readonly setRule: SetPostingRuleUseCase,
    private readonly deleteRule: DeletePostingRuleUseCase,
    private readonly seedDefaults: SeedDefaultPostingRulesUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Claves soportadas y cuentas parametrizadas' })
  list() {
    return this.listRules.execute();
  }

  @Post('defaults')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Carga el PUC mínimo y la parametrización por defecto (idempotente; no sobrescribe reglas existentes)',
  })
  loadDefaults(@CurrentActor() actor: AuthenticatedActor) {
    return this.seedDefaults.execute(actor);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Asigna la cuenta de una clave (p. ej. payment.debit.method.efectivo)' })
  set(@Param('key') key: string, @Body() dto: SetPostingRuleDto, @CurrentActor() actor: AuthenticatedActor) {
    return this.setRule.execute({ key, accountId: dto.accountId, actor });
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina la parametrización de una clave' })
  async remove(@Param('key') key: string): Promise<void> {
    await this.deleteRule.execute(key);
  }
}
