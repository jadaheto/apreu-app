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
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { Role } from '../../../../shared/domain/role.js';
import { CreateAccountUseCase } from '../../application/create-account.use-case.js';
import { DeleteAccountUseCase } from '../../application/delete-account.use-case.js';
import { ListAccountsUseCase } from '../../application/list-accounts.use-case.js';
import { SeedStandardPucUseCase } from '../../application/seed-standard-puc.use-case.js';
import { UpdateAccountUseCase } from '../../application/update-account.use-case.js';
import { ACCOUNTING_ROLES } from './accounting-roles.js';
import { CreateAccountDto, ListAccountsQueryDto, UpdateAccountDto } from './dto/account.dto.js';

@ApiTags('Contabilidad - Plan de cuentas')
@ApiBearerAuth()
@Roles(...ACCOUNTING_ROLES)
@Controller('accounting/accounts')
export class AccountsController {
  constructor(
    private readonly listAccounts: ListAccountsUseCase,
    private readonly createAccount: CreateAccountUseCase,
    private readonly updateAccount: UpdateAccountUseCase,
    private readonly deleteAccount: DeleteAccountUseCase,
    private readonly seedPuc: SeedStandardPucUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Plan de cuentas (plano o jerárquico)' })
  list(@Query() query: ListAccountsQueryDto) {
    return this.listAccounts.execute(query);
  }

  @Post()
  @ApiOperation({ summary: 'Crea una cuenta PUC' })
  create(@Body() dto: CreateAccountDto) {
    return this.createAccount.execute(dto);
  }

  @Post('seed-puc')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Carga el PUC base para colegios (idempotente)' })
  seed() {
    return this.seedPuc.execute();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renombra la cuenta o cambia si recibe movimientos' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAccountDto) {
    return this.updateAccount.execute({ id, ...dto });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina una cuenta sin movimientos ni subcuentas' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteAccount.execute(id);
  }
}
