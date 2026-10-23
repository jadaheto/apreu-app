import { ApiProperty } from '@nestjs/swagger';
import { DOCUMENT_TYPES, type DocumentType } from '../../../domain/catalogs.js';
import { DOCUMENT_STATUSES, type DocumentStatus } from '../../../domain/electronic-document.js';
import { PORTAL_ARTIFACTS, type PortalArtifact } from '../../../application/portal-document-view.js';

/** Swagger schema of `PortalDocumentView`. */
export class PortalDocumentDto {
  @ApiProperty({ example: 15 })
  id: number;

  @ApiProperty({ enum: DOCUMENT_TYPES, description: 'fv factura, nc nota crédito, nd nota débito' })
  documentType: DocumentType;

  @ApiProperty({ example: 'Factura electrónica de venta' })
  documentTypeName: string;

  @ApiProperty({ example: 'FE1234', description: 'Número completo (prefijo + consecutivo)' })
  number: string;

  @ApiProperty({ example: 'FE' })
  prefix: string;

  @ApiProperty({ example: '2026-03-15' })
  issueDate: string;

  @ApiProperty({ example: 350000 })
  totalAmount: number;

  @ApiProperty({ enum: DOCUMENT_STATUSES })
  status: DocumentStatus;

  @ApiProperty({ type: String, nullable: true, description: 'CUFE (facturas) o CUDE (notas)' })
  cufe: string | null;

  @ApiProperty({ enum: PORTAL_ARTIFACTS, isArray: true, description: 'Archivos descargables (solo validados DIAN)' })
  artifacts: PortalArtifact[];
}

export class PortalDocumentsPageDto {
  @ApiProperty({ type: [PortalDocumentDto] })
  items: PortalDocumentDto[];

  @ApiProperty({ example: 1 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
