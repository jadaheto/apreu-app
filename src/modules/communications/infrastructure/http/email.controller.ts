import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { GetEmailKpisUseCase } from '../../application/email/get-email-kpis.use-case.js';
import { ListEmailLogsUseCase } from '../../application/email/list-email-logs.use-case.js';
import { SendNoticeEmailUseCase } from '../../application/email/send-notice-email.use-case.js';
import { TestSmtpConnectionUseCase } from '../../application/email/test-smtp-connection.use-case.js';
import { UploadEmailImageUseCase } from '../../application/email/upload-email-image.use-case.js';
import { SendInvoiceEmailUseCase } from '../../application/events/send-invoice-email.use-case.js';
import { EmailLogsQueryDto, SendNoticeDto, SmtpTestDto, UploadEmailImageDto } from './dto/email.dto.js';
import { ATTACHMENT_UPLOAD_LIMITS, IMAGE_UPLOAD_LIMITS, type MultipartFile, toUploadedFile } from './multipart-file.js';

/** E-mail: dashboard, history, notices, SMTP test, e-mail images and invoice delivery. */
@ApiTags('Comunicaciones · Correo')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR, Role.FINANCE)
@Controller('communications/email')
export class EmailController {
  constructor(
    private readonly kpis: GetEmailKpisUseCase,
    private readonly logs: ListEmailLogsUseCase,
    private readonly notices: SendNoticeEmailUseCase,
    private readonly smtpTest: TestSmtpConnectionUseCase,
    private readonly images: UploadEmailImageUseCase,
    private readonly invoices: SendInvoiceEmailUseCase,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Totales: enviados, avisos, cobros, DIAN y fallidos' })
  getKpis() {
    return this.kpis.execute();
  }

  @Get('logs')
  @ApiOperation({ summary: 'Historial de correos (paginado)' })
  listLogs(@Query() query: EmailLogsQueryDto) {
    return this.logs.execute({
      criteria: { type: query.type, status: query.status, search: query.search },
      page: query.toPageRequest(),
    });
  }

  @Post('notices')
  @Roles(Role.ADMIN, Role.HR, Role.FINANCE, Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('attachments', 5, ATTACHMENT_UPLOAD_LIMITS))
  @ApiOperation({ summary: 'Envía un aviso por correo a una audiencia (docentes: solo a su grupo)' })
  sendNotice(
    @CurrentActor() actor: AuthenticatedActor,
    @Body() dto: SendNoticeDto,
    @UploadedFiles() files: MultipartFile[] | undefined,
  ) {
    return this.notices.execute({
      actor,
      audience: {
        kind: dto.audience,
        gradeId: dto.gradeId,
        classroomId: dto.classroomId,
        manualEmails: dto.manualEmails,
      },
      subject: dto.subject,
      bodyHtml: dto.bodyHtml,
      attachments: (files ?? []).map(toUploadedFile),
    });
  }

  @Post('smtp-test')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envía un correo de prueba al administrador con la cuenta SMTP configurada' })
  testSmtp(@CurrentActor() actor: AuthenticatedActor, @Body() dto: SmtpTestDto) {
    return this.smtpTest.execute({ actor, profile: dto.profile ?? 'general' });
  }

  @Post('images')
  @Roles(Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', IMAGE_UPLOAD_LIMITS))
  @ApiOperation({ summary: 'Sube el logo o la imagen promocional de los correos (PNG, JPG, GIF, WebP ≤ 2 MB)' })
  uploadImage(@Body() dto: UploadEmailImageDto, @UploadedFile() file: MultipartFile | undefined) {
    return this.images.execute({ kind: dto.type, file: file && toUploadedFile(file) });
  }

  @Post('invoices/:dianInvoiceId')
  @Roles(Role.ADMIN, Role.FINANCE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envía (o reenvía) una factura electrónica al correo del adquiriente' })
  sendInvoice(@CurrentActor() actor: AuthenticatedActor, @Param('dianInvoiceId', ParseIntPipe) dianInvoiceId: number) {
    return this.invoices.execute({ dianInvoiceId, userId: actor.userId });
  }
}
