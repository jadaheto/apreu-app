import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ChangeUserStatusUseCase } from '../../application/change-user-status.use-case.js';
import { CreateUserUseCase } from '../../application/create-user.use-case.js';
import { GetUserStatsUseCase } from '../../application/get-user-stats.use-case.js';
import { GetUserUseCase } from '../../application/get-user.use-case.js';
import { ListUsersUseCase } from '../../application/list-users.use-case.js';
import { ResetUserPasswordUseCase } from '../../application/reset-user-password.use-case.js';
import { UpdateUserUseCase } from '../../application/update-user.use-case.js';
import type { UserAdministrator } from '../../domain/user-administration-policy.js';
import {
  ChangeUserStatusDto,
  CreateUserDto,
  ListUsersQueryDto,
  ManagedUserResponseDto,
  PaginatedUsersResponseDto,
  UpdateUserDto,
  UserStatsResponseDto,
  UserWithTemporaryPasswordResponseDto,
} from './dto/user-admin.dto.js';

const administrator = (actor: AuthenticatedActor): UserAdministrator => ({ userId: actor.userId, role: actor.role });

/** User administration (legacy `admin/users.php`). Superadmin and admin only. */
@ApiTags('Usuarios')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly userStats: GetUserStatsUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly changeStatus: ChangeUserStatusUseCase,
    private readonly resetPassword: ResetUserPasswordUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista paginada de usuarios con búsqueda por nombre o correo' })
  @ApiOkResponse({ type: PaginatedUsersResponseDto })
  list(@Query() query: ListUsersQueryDto) {
    return this.listUsers.execute({
      search: query.search,
      role: query.role,
      isActive: query.active,
      page: query.toPageRequest(),
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Totales de usuarios por familia de rol' })
  @ApiOkResponse({ type: UserStatsResponseDto })
  stats() {
    return this.userStats.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un usuario' })
  @ApiOkResponse({ type: ManagedUserResponseDto })
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.getUser.execute(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crea un usuario con contraseña temporal aleatoria' })
  @ApiCreatedResponse({ type: UserWithTemporaryPasswordResponseDto })
  create(@CurrentActor() actor: AuthenticatedActor, @Body() dto: CreateUserDto) {
    return this.createUser.execute({ actor: administrator(actor), ...dto });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita nombre, correo o rol de un usuario' })
  @ApiOkResponse({ type: ManagedUserResponseDto })
  update(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.updateUser.execute({ actor: administrator(actor), userId: id, ...dto });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activa o desactiva un usuario' })
  @ApiOkResponse({ type: ManagedUserResponseDto })
  status(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeUserStatusDto,
  ) {
    return this.changeStatus.execute({ actor: administrator(actor), userId: id, active: dto.active });
  }

  @Post(':id/password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Asigna una contraseña temporal aleatoria que el usuario debe cambiar' })
  @ApiOkResponse({ type: UserWithTemporaryPasswordResponseDto })
  reset(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.resetPassword.execute({ actor: administrator(actor), userId: id });
  }
}
