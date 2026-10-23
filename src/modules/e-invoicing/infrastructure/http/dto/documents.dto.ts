import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import type { PaymentForm, TaxTreatment } from '../../../domain/catalogs.js';
import { DOCUMENT_STATUSES, type DocumentStatus } from '../../../domain/electronic-document.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CustomerDto {
  @ApiProperty({ example: 'María Gómez' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '13', description: 'Tipo de documento DIAN (13 CC, 31 NIT, 12 TI, 22 CE, 41 pasaporte…)' })
  @Matches(/^\d{2}$/)
  idType: string;

  @ApiProperty({ example: '1065432198' })
  @Matches(/^[A-Za-z0-9.\- ]{3,30}$/)
  idNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: '70001', description: 'Municipio DANE; por defecto el del colegio' })
  @IsOptional()
  @Matches(/^\d{5}$/)
  cityCode?: string;

  @ApiPropertyOptional({ example: 'R-99-PN' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxLevelCode?: string;

  @ApiPropertyOptional({ enum: ['48', '49'] })
  @IsOptional()
  @IsIn(['48', '49'])
  vatRegime?: '48' | '49';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  familyName?: string;
}

export class DocumentLineDto {
  @ApiProperty({ example: 'Pensión marzo' })
  @IsString()
  @MaxLength(300)
  description: string;

  @ApiPropertyOptional({ example: 'PEN' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({ example: 1 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: 350000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitPrice: number;

  @ApiPropertyOptional({
    enum: ['excluded', 'exempt', 'taxed'],
    default: 'excluded',
    description: 'Servicios educativos: excluidos de IVA',
  })
  @IsOptional()
  @IsIn(['excluded', 'exempt', 'taxed'])
  taxTreatment?: TaxTreatment;

  @ApiPropertyOptional({ example: 19, description: 'Tarifa de IVA (solo líneas gravadas)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class PaymentMeansDto {
  @ApiProperty({ enum: ['1', '2'], description: '1 contado, 2 crédito' })
  @IsIn(['1', '2'])
  form: PaymentForm;

  @ApiProperty({ example: '10', description: 'Medio de pago DIAN (10 efectivo, 47 transferencia, 48/49 tarjetas…)' })
  @IsString()
  @MaxLength(5)
  code: string;

  @ApiPropertyOptional({ example: '2026-04-30', description: 'Obligatoria a crédito' })
  @IsOptional()
  @Matches(DAY)
  dueDate?: string;
}

class LinesDto {
  @ApiProperty({ type: [DocumentLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines: DocumentLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class IssueInvoiceDto extends LinesDto {
  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @ApiProperty({ type: PaymentMeansDto })
  @ValidateNested()
  @Type(() => PaymentMeansDto)
  paymentMeans: PaymentMeansDto;
}

export class IssueCreditNoteDto {
  @ApiProperty({ example: '2', description: '1 devolución, 2 anulación, 3 descuento, 4 ajuste de precio, 5 otros' })
  @IsIn(['1', '2', '3', '4', '5'])
  conceptCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [DocumentLineDto], description: 'Omitir solo en anulación total (concepto 2)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => DocumentLineDto)
  lines?: DocumentLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class IssueDebitNoteDto extends LinesDto {
  @ApiProperty({ example: '1', description: '1 intereses, 2 gastos por cobrar, 3 cambio del valor, 4 otros' })
  @IsIn(['1', '2', '3', '4'])
  conceptCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

export class DocumentDateRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(DAY)
  to?: string;
}

export class ListDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['fv', 'nc', 'nd'] })
  @IsOptional()
  @IsIn(['fv', 'nc', 'nd'])
  type?: 'fv' | 'nc' | 'nd';

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatus;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(DAY)
  to?: string;
}

export class TestSetPlanDto {
  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(0)
  @Max(100)
  invoices: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  @Max(100)
  creditNotes: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  @Max(100)
  debitNotes: number;
}

export class ResetNumberingDto {
  @ApiProperty({ type: [String], enum: ['fv', 'nc', 'nd'], example: ['fv', 'nc', 'nd'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['fv', 'nc', 'nd'], { each: true })
  types: ('fv' | 'nc' | 'nd')[];
}
