import {
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ForbiddenError } from '../../../../shared/domain/domain-error.js';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { TenantContext } from '../../../../shared/infrastructure/tenancy/tenant-context.js';
import {
  HandleWhatsAppStatusWebhookUseCase,
  VerifyWhatsAppWebhookUseCase,
} from '../../application/whatsapp/whatsapp-webhook.use-cases.js';

/**
 * Meta WhatsApp Cloud API webhook (callback URL `/api/webhooks/whatsapp/<tenant>`).
 * Public, but every delivery must carry a valid `X-Hub-Signature-256`.
 * The `:tenant` segment must match the tenant resolved for the request.
 * Not throttled: Meta delivers receipts in bursts from few IP addresses.
 */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly verify: VerifyWhatsAppWebhookUseCase,
    private readonly handle: HandleWhatsAppStatusWebhookUseCase,
    private readonly tenants: TenantContext,
  ) {}

  @Get(':tenant')
  @Header('Content-Type', 'text/plain')
  subscribe(
    @Param('tenant') tenant: string,
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): Promise<string> {
    this.assertTenant(tenant);
    return this.verify.execute({ mode, token, challenge });
  }

  @Post(':tenant')
  @HttpCode(HttpStatus.OK)
  receive(
    @Param('tenant') tenant: string,
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
  ) {
    this.assertTenant(tenant);
    return this.handle.execute({ rawBody: request.rawBody, signature });
  }

  private assertTenant(slug: string): void {
    if (this.tenants.current()?.slug !== slug.toLowerCase()) {
      throw new ForbiddenError('El webhook no corresponde a este colegio.');
    }
  }
}
