import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Role } from '../../../../shared/domain/role.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CheckDocumentStatusUseCase } from '../../application/check-document-status.use-case.js';
import {
  ARTIFACT_KINDS,
  type ArtifactKind,
  GetDocumentArtifactUseCase,
} from '../../application/get-document-artifact.use-case.js';
import { GetDocumentStatsUseCase } from '../../application/get-document-stats.use-case.js';
import { GetDocumentUseCase } from '../../application/get-document.use-case.js';
import { IssueCreditNoteUseCase } from '../../application/issue-credit-note.use-case.js';
import { IssueDebitNoteUseCase } from '../../application/issue-debit-note.use-case.js';
import { IssueInvoiceUseCase } from '../../application/issue-invoice.use-case.js';
import { ListDocumentsUseCase } from '../../application/list-documents.use-case.js';
import { RetryPendingSubmissionsUseCase } from '../../application/retry-pending-submissions.use-case.js';
import { SubmitDocumentUseCase } from '../../application/submit-document.use-case.js';
import {
  DocumentDateRangeQueryDto,
  IssueCreditNoteDto,
  IssueDebitNoteDto,
  IssueInvoiceDto,
  ListDocumentsQueryDto,
} from './dto/documents.dto.js';

/** Electronic invoices and notes: issuance, DIAN submission, status and artifacts (legacy `api/dian/*`, now authenticated). */
@ApiTags('Facturación electrónica · Documentos')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.FINANCE)
@Controller('e-invoicing/documents')
export class DocumentsController {
  constructor(
    private readonly listDocuments: ListDocumentsUseCase,
    private readonly documentStats: GetDocumentStatsUseCase,
    private readonly getDocument: GetDocumentUseCase,
    private readonly issueInvoice: IssueInvoiceUseCase,
    private readonly issueCreditNote: IssueCreditNoteUseCase,
    private readonly issueDebitNote: IssueDebitNoteUseCase,
    private readonly submitDocument: SubmitDocumentUseCase,
    private readonly checkStatus: CheckDocumentStatusUseCase,
    private readonly retryPending: RetryPendingSubmissionsUseCase,
    private readonly artifacts: GetDocumentArtifactUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista documentos por tipo, estado, fechas y texto' })
  list(@Query() query: ListDocumentsQueryDto) {
    const { type, status, from, to, search } = query;
    return this.listDocuments.execute({ criteria: { type, status, from, to, search }, page: query.toPageRequest() });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Indicadores: documentos por tipo y estado, total facturado aceptado' })
  stats(@Query() query: DocumentDateRangeQueryDto) {
    return this.documentStats.execute({ from: query.from, to: query.to });
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Emite una factura electrónica de venta y la envía a la DIAN' })
  createInvoice(@Body() dto: IssueInvoiceDto) {
    return this.issueInvoice.execute(dto);
  }

  @Post('retry-pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reenvía los documentos firmados sin enviar o con error de transporte' })
  retry() {
    return this.retryPending.execute();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle con líneas, respuesta DIAN e historial de envíos' })
  show(@Param('id', ParseIntPipe) id: number) {
    return this.getDocument.execute(id);
  }

  @Post(':id/credit-notes')
  @ApiOperation({ summary: 'Emite una nota crédito que referencia la factura' })
  createCreditNote(@Param('id', ParseIntPipe) id: number, @Body() dto: IssueCreditNoteDto) {
    return this.issueCreditNote.execute({ invoiceId: id, ...dto });
  }

  @Post(':id/debit-notes')
  @ApiOperation({ summary: 'Emite una nota débito que referencia la factura' })
  createDebitNote(@Param('id', ParseIntPipe) id: number, @Body() dto: IssueDebitNoteDto) {
    return this.issueDebitNote.execute({ invoiceId: id, ...dto });
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Reintenta el envío (solo firmados o con error de envío)' })
  submit(@Param('id', ParseIntPipe) id: number) {
    return this.submitDocument.execute(id);
  }

  @Post(':id/status-check')
  @ApiOperation({ summary: 'Consulta el estado en la DIAN (GetStatusZip)' })
  statusCheck(@Param('id', ParseIntPipe) id: number) {
    return this.checkStatus.execute(id);
  }

  @Get(':id/:artifact')
  @ApiParam({ name: 'artifact', enum: ARTIFACT_KINDS })
  @ApiOperation({ summary: 'Descarga el XML firmado, el ZIP, el ApplicationResponse o el AttachedDocument' })
  async download(
    @Param('id', ParseIntPipe) id: number,
    @Param('artifact') artifact: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!ARTIFACT_KINDS.includes(artifact as ArtifactKind)) throw new NotFoundException('Artefacto no disponible.');
    const file = await this.artifacts.execute({ documentId: id, kind: artifact as ArtifactKind });
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    return new StreamableFile(file.content, { type: file.contentType });
  }
}
