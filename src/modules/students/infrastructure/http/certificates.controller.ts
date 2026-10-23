import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Public } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { ApproveCertificateUseCase } from '../../application/approve-certificate.use-case.js';
import { CancelCertificateUseCase } from '../../application/cancel-certificate.use-case.js';
import { GetCertificateDocumentUseCase } from '../../application/get-certificate-document.use-case.js';
import { RenderCertificatePdfUseCase } from '../../application/render-certificate-pdf.use-case.js';
import { VerifyCertificateUseCase } from '../../application/verify-certificate.use-case.js';
import { CancelCertificateDto } from './dto/certificate.dto.js';

/** Approval, cancellation and printing of study certificates. */
@ApiTags('Certificados')
@ApiBearerAuth()
@Controller('certificates')
export class CertificatesController {
  constructor(
    private readonly approveCertificate: ApproveCertificateUseCase,
    private readonly cancelCertificate: CancelCertificateUseCase,
    private readonly certificateDocument: GetCertificateDocumentUseCase,
    private readonly certificatePdf: RenderCertificatePdfUseCase,
  ) {}

  @Post(':id/approve')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprueba una solicitud de certificado' })
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.approveCertificate.execute(id);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anula un certificado o rechaza una solicitud' })
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelCertificateDto) {
    return this.cancelCertificate.execute({
      certificateId: id,
      reason: dto.reason,
    });
  }

  @Get(':id/document')
  @Roles(Role.ADMIN, Role.STUDENT, Role.PARENT)
  @ApiOperation({
    summary: 'Contenido imprimible del certificado (solo aprobados)',
  })
  document(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.certificateDocument.execute({ actor, certificateId: id });
  }

  @Get(':id/pdf')
  @Roles(Role.ADMIN, Role.STUDENT, Role.PARENT)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Certificado en PDF con membrete y código QR de verificación (solo aprobados)' })
  async pdf(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number): Promise<StreamableFile> {
    const file = await this.certificatePdf.execute({ actor, certificateId: id });
    return new StreamableFile(file.content, {
      type: file.contentType,
      disposition: `inline; filename="${file.fileName}"`,
    });
  }
}

/** Public verification of certificates by their code (requires the `X-Tenant` header). */
@ApiTags('Certificados')
@ApiHeader({
  name: 'X-Tenant',
  description: 'Slug del colegio',
  required: true,
})
@Controller('public/certificates')
export class PublicCertificatesController {
  constructor(private readonly verifyCertificate: VerifyCertificateUseCase) {}

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('verify/:code')
  @ApiOperation({ summary: 'Verifica la autenticidad de un certificado' })
  verify(@Param('code') code: string) {
    return this.verifyCertificate.execute(code);
  }
}
