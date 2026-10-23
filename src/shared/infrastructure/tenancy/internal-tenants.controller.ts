import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../http/decorators/public.decorator.js';
import { INTERNAL_TOKEN_HEADER, InternalTokenGuard } from '../http/guards/internal-token.guard.js';
import { TenantResolver } from './tenant-resolver.js';

/**
 * Service-to-service endpoints used by `superadmin-api`. Not tied to a school
 * (no `X-Tenant`) and authenticated with `INTERNAL_API_TOKEN` instead of a JWT.
 */
@ApiTags('Interno (superadmin-api)')
@ApiHeader({ name: INTERNAL_TOKEN_HEADER, required: true, description: 'Secreto compartido INTERNAL_API_TOKEN' })
@Public()
@UseGuards(InternalTokenGuard)
@Controller('internal/tenants')
export class InternalTenantsController {
  constructor(private readonly resolver: TenantResolver) {}

  /**
   * Drops the cached registry entry of a school so a suspension (or
   * reactivation, rename…) applies on the next request of this instance.
   * Idempotent.
   */
  @Post(':slug/invalidate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalida la caché del colegio (tras suspenderlo/reactivarlo en superadmin)' })
  invalidate(@Param('slug') slug: string): void {
    this.resolver.invalidate(slug);
  }
}
