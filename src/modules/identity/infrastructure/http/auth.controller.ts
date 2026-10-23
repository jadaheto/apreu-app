import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import { ChangePasswordUseCase } from '../../application/change-password.use-case.js';
import { GetCurrentUserUseCase } from '../../application/get-current-user.use-case.js';
import { LoginUseCase } from '../../application/login.use-case.js';
import { LoginResponseDto, UserResponseDto } from './dto/auth-responses.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AllowPendingPasswordChange } from './guards/allow-pending-password-change.decorator.js';

@ApiTags('Autenticación')
@ApiHeader({ name: 'X-Tenant', description: 'Slug del colegio', required: true })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly currentUser: GetCurrentUserUseCase,
    private readonly changePassword: ChangePasswordUseCase,
    private readonly tenantContext: TenantContext,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia sesión y devuelve un token JWT' })
  @ApiOkResponse({ type: LoginResponseDto })
  signIn(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.login.execute({
      email: dto.email,
      password: dto.password,
      tenant: this.tenantContext.require().slug,
      ipAddress: ip ?? '0.0.0.0',
    });
  }

  @Get('me')
  @AllowPendingPasswordChange()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado' })
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentActor() actor: AuthenticatedActor) {
    return this.currentUser.execute(actor.userId);
  }

  @Patch('password')
  @AllowPendingPasswordChange()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambia la contraseña del usuario autenticado' })
  async updatePassword(@CurrentActor() actor: AuthenticatedActor, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.changePassword.execute({ userId: actor.userId, ...dto });
  }
}
