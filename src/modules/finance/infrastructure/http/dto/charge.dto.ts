import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { CHARGE_STATUSES, type ChargeStatus } from '../../../domain/student-charge.js';
import { DATE_REGEX, PERIOD_REGEX, ToBoolean } from './transforms.js';

export class ChargeBatchDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conceptId: number;

  @ApiProperty({ example: '2026-03', description: 'Mes a cobrar (AAAA-MM)' })
  @Matches(PERIOD_REGEX, { message: 'El mes debe tener el formato AAAA-MM.' })
  period: string;

  @ApiPropertyOptional({ example: '2026-03-31', description: 'Por defecto, último día del mes' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  dueDate?: string;

  @ApiPropertyOptional({ description: 'Grado (todos si se omite)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeId?: number;

  @ApiPropertyOptional({ description: 'Monto personalizado (> 0); prevalece sobre tarifas' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  customAmount?: number;

  @ApiPropertyOptional({ default: false, description: 'Aplica el % de beca del estudiante como descuento' })
  @IsOptional()
  @IsBoolean()
  applyScholarship?: boolean;
}

export class IndividualChargeDto extends ChargeBatchDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiPropertyOptional({ description: 'Descripción personalizada' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ default: false, description: 'Permite repetir concepto en el mismo mes' })
  @IsOptional()
  @IsBoolean()
  allowDuplicate?: boolean;
}

export class ListChargesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conceptId?: number;

  @ApiPropertyOptional({ enum: CHARGE_STATUSES })
  @IsOptional()
  @IsIn(CHARGE_STATUSES)
  status?: ChargeStatus;

  @ApiPropertyOptional({ example: '2026-03' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'El mes debe tener el formato AAAA-MM.' })
  period?: string;

  @ApiPropertyOptional({ description: 'Sólo cargos vencidos con saldo' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  overdueOnly?: boolean;
}

export class ChargesSummaryQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
