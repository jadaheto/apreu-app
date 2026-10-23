import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { REPORT_FORMATS, type ReportFormat } from '../../../application/ports/report-renderer.port.js';
import type { AccountLevel } from '../../../domain/account-code.js';
import { VOUCHER_TYPES, type VoucherType } from '../../../domain/voucher-type.js';
import { DAY_MESSAGE, DAY_REGEX } from './query-transformers.js';

export class AccountingDateRangeQueryDto {
  @ApiProperty({ example: '2026-01-01' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  from: string;

  @ApiProperty({ example: '2026-12-31' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  to: string;
}

export class TrialBalanceQueryDto extends AccountingDateRangeQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: '1 Clase, 2 Grupo, 3 Cuenta, 4 Subcuenta, 5 Auxiliar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  level?: AccountLevel;
}

export class GeneralJournalQueryDto extends PaginationQueryDto {
  @ApiProperty({ example: '2026-01-01' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  from: string;

  @ApiProperty({ example: '2026-01-31' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  to: string;

  @ApiPropertyOptional({ enum: VOUCHER_TYPES })
  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  type?: VoucherType;
}

export class GeneralLedgerQueryDto extends AccountingDateRangeQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;
}

export class AuxiliaryLedgerQueryDto extends AccountingDateRangeQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  thirdPartyId?: number;
}

export class BalanceSheetQueryDto {
  @ApiProperty({ example: '2026-12-31' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  asOf: string;
}

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-03', description: 'Mes AAAA-MM (por defecto el actual)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'Debe tener formato AAAA-MM.' })
  month?: string;
}

export class ExportReportQueryDto {
  @ApiProperty({ enum: REPORT_FORMATS, default: 'csv' })
  @IsIn(REPORT_FORMATS)
  format: ReportFormat = 'csv';

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  to?: string;

  @ApiPropertyOptional({ description: 'Fecha de corte (balance general)' })
  @IsOptional()
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  asOf?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  level?: AccountLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  accountId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  thirdPartyId?: number;

  @ApiPropertyOptional({ enum: VOUCHER_TYPES })
  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  type?: VoucherType;
}
