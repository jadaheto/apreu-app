import { Controller, Get, HttpCode, HttpStatus, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { GetMyPermissionsUseCase } from '../../application/get-my-permissions.use-case.js';
import { LogoutUseCase } from '../../application/logout.use-case.js';
import { RefreshSessionUseCase } from '../../application/refresh-session.use-case.js';
import { MyPermissionsResponseDto, RefreshSessionResponseDto } from './dto/session.dto.js';
import { AllowPendingPasswordChange } from './guards/allow-pending-password-change.decorator.js';

/** Session lifecycle and authorization data for the signed-in user (any role). */
@ApiTags('Autenticación')
@ApiBearerAuth()
@Controller('auth')
export class SessionController {
  constructor(
    private readonly myPermissions: GetMyPermissionsUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  @Get('permissions')
  @AllowPendingPasswordChange()
  @ApiOperation({ summary: 'Permisos y módulos accesibles del usuario (para construir el menú)' })
  @ApiOkResponse({ type: MyPermissionsResponseDto })
  permissions(@CurrentActor() actor: AuthenticatedActor) {
    return this.myPermissions.execute(actor.role);
  }

  @Post('refresh')
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renueva el token de una sesión activa (sesión deslizante)' })
  @ApiOkResponse({ type: RefreshSessionResponseDto })
  refresh(@CurrentActor() actor: AuthenticatedActor) {
    return this.refreshSession.execute({ userId: actor.userId, tenant: actor.tenant });
  }

  @Post('logout')
  @AllowPendingPasswordChange()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Registra el cierre de sesión' })
  @ApiNoContentResponse()
  async signOut(@CurrentActor() actor: AuthenticatedActor, @Ip() ip: string): Promise<void> {
    await this.logout.execute({ actor, ipAddress: ip ?? '0.0.0.0' });
  }
}
