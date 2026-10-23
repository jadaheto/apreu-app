import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { PAY_FREQUENCIES, type PayFrequency } from '../../../domain/payroll/pay-frequency.js';
import { NOVELTY_TYPES, type NoveltyType } from '../../../domain/payroll/payroll-novelty.js';
import { PAYROLL_PERIOD_STATUSES, type PayrollPeriodStatus } from '../../../domain/payroll/payroll-period.js';

const RATE = [IsOptional(), IsNumber({ maxDecimalPlaces: 3 }), Min(0), Max(100)];
const rate = (): PropertyDecorator => (target, key) => RATE.forEach((d) => d(target, key));

export class ArlRatesDto {
  @ApiPropertyOptional({ example: 0.522 }) @rate() 1?: number;
  @ApiPropertyOptional({ example: 1.044 }) @rate() 2?: number;
  @ApiPropertyOptional({ example: 2.436 }) @rate() 3?: number;
  @ApiPropertyOptional({ example: 4.35 }) @rate() 4?: number;
  @ApiPropertyOptional({ example: 6.96 }) @rate() 5?: number;
}

export class PayrollRatesDto {
  @ApiPropertyOptional({ example: 4 }) @rate() healthEmployee?: number;
  @ApiPropertyOptional({ example: 4 }) @rate() pensionEmployee?: number;
  @ApiPropertyOptional({ example: 8.5 }) @rate() healthEmployer?: number;
  @ApiPropertyOptional({ example: 12 }) @rate() pensionEmployer?: number;
  @ApiPropertyOptional({ example: 2 }) @rate() sena?: number;
  @ApiPropertyOptional({ example: 3 }) @rate() icbf?: number;
  @ApiPropertyOptional({ example: 4 }) @rate() ccf?: number;
  @ApiPropertyOptional({ type: ArlRatesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ArlRatesDto)
  arl?: ArlRatesDto;
}

export class PayrollParametersDto {
  @ApiProperty({ example: 1750905 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) minimumWage: number;
  @ApiProperty({ example: 249095 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) transportAllowance: number;
  @ApiProperty({ example: 52374 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) uvt: number;
  @ApiPropertyOptional({ type: PayrollRatesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayrollRatesDto)
  rates?: PayrollRatesDto;
  @ApiPropertyOptional({ description: 'Exoneración art. 114-1 ET (validar con el contador)' })
  @IsOptional()
  @IsBoolean()
  employerContributionExemption?: boolean;
}

export class CreatePayrollPeriodDto {
  @ApiPropertyOptional({ example: 'Nómina marzo 2026' }) @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiProperty({ example: '2026-03-01' }) @IsISO8601({ strict: true }) startDate: string;
  @ApiProperty({ example: '2026-03-31' }) @IsISO8601({ strict: true }) endDate: string;
  @ApiProperty({ example: '2026-03-30' }) @IsISO8601({ strict: true }) paymentDate: string;
  @ApiProperty({ enum: PAY_FREQUENCIES }) @IsIn(PAY_FREQUENCIES) frequency: PayFrequency;
}

export class RegisterNoveltyDto {
  @ApiProperty() @IsInt() @Min(1) employeeId: number;
  @ApiProperty({ enum: NOVELTY_TYPES }) @IsIn(NOVELTY_TYPES) type: NoveltyType;
  @ApiProperty({ example: 50000, description: 'Valor del período (no se prorratea)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) description?: string;
}

export class CancelPayrollPeriodDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) reason: string;
}

export class ListPayrollPeriodsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
  @ApiPropertyOptional({ enum: PAYROLL_PERIOD_STATUSES })
  @IsOptional()
  @IsIn(PAYROLL_PERIOD_STATUSES)
  status?: PayrollPeriodStatus;
}

export class PayrollKpisQueryDto {
  @ApiProperty({ example: '2026-03' }) @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) month: string;
}
