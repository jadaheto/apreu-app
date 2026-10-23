import { Controller, Get, Param, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { RenderIssuedDocumentUseCase } from '../../application/documents/render-issued-document.use-case.js';
import { VerifyIssuedDocumentUseCase } from '../../application/documents/verify-issued-document.use-case.js';
import { sendDocument } from './send-document.js';

/** Issued certificates: printable copy (owner or HR) and public verification by code. */
@ApiTags('RR. HH. - Documentos')
@Controller('hr/documents')
export class HrDocumentsController {
  constructor(
    private readonly renderDocument: RenderIssuedDocumentUseCase,
    private readonly verifyDocument: VerifyIssuedDocumentUseCase,
  ) {}

  /** Public (JWT-less, only `X-Tenant`); throttled like the student certificates to deter code guessing. */
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('verify/:code')
  @ApiHeader({ name: 'X-Tenant', description: 'Slug del colegio', required: true })
  @ApiOperation({ summary: 'Verifica la autenticidad de un certificado (público, sin datos salariales)' })
  verify(@Param('code') code: string) {
    return this.verifyDocument.execute(code);
  }

  /** Any authenticated user; the use case only serves HR or the employee the document belongs to. */
  @Get(':code/document')
  @ApiBearerAuth()
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Copia imprimible de un certificado expedido (PDF)' })
  async document(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('code') code: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendDocument(res, await this.renderDocument.execute({ actor, code }));
  }
}
