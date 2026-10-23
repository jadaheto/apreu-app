import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import {
  COLLECTION_FILE_BANKS,
  PAYROLL_FILE_BANKS,
  type CollectionFileBank,
  type PayrollFileBank,
} from '../../../domain/bank-files/bank-file.js';
import { RISK_LEVELS, type RiskLevel } from '../../../domain/risk-level.js';
import { PERIOD_REGEX } from './transforms.js';

export class AgingQueryDto {
  @ApiPropertyOptional({ enum: RISK_LEVELS })
  @IsOptional()
  @IsIn(RISK_LEVELS)
  risk?: RiskLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeId?: number;
}

export class CollectionFileDto {
  @ApiProperty({ enum: COLLECTION_FILE_BANKS })
  @IsIn(COLLECTION_FILE_BANKS)
  bank: CollectionFileBank;

  @ApiProperty({ example: '2026-03' })
  @Matches(PERIOD_REGEX, { message: 'El mes debe tener el formato AAAA-MM.' })
  month: string;
}

export class PayrollFileDto {
  @ApiProperty({ enum: PAYROLL_FILE_BANKS })
  @IsIn(PAYROLL_FILE_BANKS)
  bank: PayrollFileBank;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId: number;
}

export class SearchStudentsQueryDto {
  @ApiProperty({ description: 'Nombre, código o documento (mínimo 2 caracteres)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;

  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;
}
