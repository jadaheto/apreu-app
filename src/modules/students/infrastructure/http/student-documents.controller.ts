import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetStudentFinancialSummaryUseCase } from '../../application/get-student-financial-summary.use-case.js';
import { GetStudentIdCardUseCase } from '../../application/get-student-id-card.use-case.js';
import { IssueCertificateUseCase } from '../../application/issue-certificate.use-case.js';
import { ListStudentCertificatesUseCase } from '../../application/list-student-certificates.use-case.js';
import { RequestCertificateUseCase } from '../../application/request-certificate.use-case.js';
import { VerifyStudentQrUseCase } from '../../application/verify-student-qr.use-case.js';
import { CertificateRequestDto } from './dto/certificate.dto.js';
import { VerifyStudentQrDto } from './dto/student.dto.js';

/**
 * Documents and statements of a student shared by the office and the
 * portal (legacy `students/portal.php`): ID card with signed QR, account
 * statement and certificates. Ownership is verified in the use cases.
 */
@ApiTags('Estudiantes - documentos')
@ApiBearerAuth()
@Controller('students')
export class StudentDocumentsController {
  constructor(
    private readonly idCard: GetStudentIdCardUseCase,
    private readonly verifyQr: VerifyStudentQrUseCase,
    private readonly financialSummary: GetStudentFinancialSummaryUseCase,
    private readonly listCertificates: ListStudentCertificatesUseCase,
    private readonly issueCertificate: IssueCertificateUseCase,
    private readonly requestCertificate: RequestCertificateUseCase,
  ) {}

  @Post('id-card/verify')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Identifica al estudiante de un QR de carnet firmado',
  })
  verify(@CurrentActor() actor: AuthenticatedActor, @Body() dto: VerifyStudentQrDto) {
    return this.verifyQr.execute({ actor, rawQr: dto.rawQr });
  }

  @Get(':id/id-card')
  @Roles(Role.ADMIN, Role.STUDENT, Role.PARENT)
  @ApiOperation({ summary: 'Carnet digital con QR firmado' })
  card(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.idCard.execute({ actor, studentId: id });
  }

  @Get(':id/financial-summary')
  @Roles(Role.ADMIN, Role.FINANCE, Role.STUDENT, Role.PARENT)
  @ApiOperation({
    summary: 'Estado de cuenta: totales, cargos pendientes y pagos',
  })
  finance(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.financialSummary.execute({ actor, studentId: id });
  }

  @Get(':id/certificates')
  @Roles(Role.ADMIN, Role.STUDENT, Role.PARENT)
  @ApiOperation({ summary: 'Certificados del estudiante' })
  certificates(@CurrentActor() actor: AuthenticatedActor, @Param('id', ParseIntPipe) id: number) {
    return this.listCertificates.execute({ actor, studentId: id });
  }

  @Post(':id/certificates')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Emite un certificado aprobado (emisión manual)' })
  issue(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CertificateRequestDto,
  ) {
    return this.issueCertificate.execute({
      actor,
      studentId: id,
      type: dto.type,
      notes: dto.notes,
    });
  }

  @Post(':id/certificate-requests')
  @Roles(Role.ADMIN, Role.STUDENT, Role.PARENT)
  @ApiOperation({
    summary: 'Solicita un certificado (queda pendiente de aprobación)',
  })
  request(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CertificateRequestDto,
  ) {
    return this.requestCertificate.execute({
      actor,
      studentId: id,
      type: dto.type,
      notes: dto.notes,
    });
  }
}
