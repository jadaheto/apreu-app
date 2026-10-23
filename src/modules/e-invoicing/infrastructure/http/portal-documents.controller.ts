import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { CurrentActor } from '../../../../shared/infrastructure/http/decorators/current-actor.decorator.js';
import { Roles } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetPortalDocumentArtifactUseCase } from '../../application/get-portal-document-artifact.use-case.js';
import { ListPortalStudentDocumentsUseCase } from '../../application/list-portal-student-documents.use-case.js';
import { PORTAL_ARTIFACTS, type PortalArtifact } from '../../application/portal-document-view.js';
import { PortalDocumentsPageDto } from './dto/portal-documents.dto.js';

/**
 * Electronic invoices and notes of a student for the student/guardian portal.
 * The student is explicit in the URL and its ownership is verified by the use
 * cases (same rule as `/api/portal/students/{id}` and `/api/finance/portal`).
 */
@ApiTags('Facturación electrónica · Portal estudiante/acudiente')
@ApiBearerAuth()
@Roles(Role.STUDENT, Role.PARENT)
@Controller('e-invoicing/portal/students/:studentId/documents')
export class PortalDocumentsController {
  constructor(
    private readonly listDocuments: ListPortalStudentDocumentsUseCase,
    private readonly artifacts: GetPortalDocumentArtifactUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Facturas y notas electrónicas del estudiante (más recientes primero)' })
  @ApiOkResponse({ type: PortalDocumentsPageDto })
  list(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Query() query: PaginationQueryDto,
  ) {
    return this.listDocuments.execute({ actor, studentId, page: query.toPageRequest() });
  }

  @Get(':id/:artifact')
  @ApiParam({ name: 'artifact', enum: PORTAL_ARTIFACTS })
  @ApiProduces('application/pdf', 'application/xml')
  @ApiOperation({
    summary: 'Descarga el PDF (representación gráfica) o el XML (AttachedDocument) de un documento validado',
  })
  async download(
    @CurrentActor() actor: AuthenticatedActor,
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('artifact') artifact: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    if (!PORTAL_ARTIFACTS.includes(artifact as PortalArtifact)) {
      throw new NotFoundException('Artefacto no disponible.');
    }
    const file = await this.artifacts.execute({
      actor,
      studentId,
      documentId: id,
      artifact: artifact as PortalArtifact,
    });
    response.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.content, { type: file.contentType });
  }
}
