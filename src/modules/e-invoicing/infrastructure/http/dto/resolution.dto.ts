import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import type { DianEnvironment, DocumentType } from '../../../domain/catalogs.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class RegisterResolutionDto {
  @ApiProperty({ enum: ['fv', 'nc', 'nd'] })
  @IsIn(['fv', 'nc', 'nd'])
  docType: DocumentType;

  @ApiProperty({ example: 'SETP' })
  @Matches(/^[A-Za-z0-9]{1,4}$/)
  prefix: string;

  @ApiProperty({ example: 990000001 })
  @IsInt()
  @Min(1)
  rangeFrom: number;

  @ApiProperty({ example: 995000000 })
  @IsInt()
  @Min(1)
  rangeTo: number;

  @ApiPropertyOptional({ description: 'Obligatorio para facturas' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  resolutionNumber?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(DAY)
  validFrom?: string;

  @ApiPropertyOptional({ example: '2027-12-31' })
  @IsOptional()
  @Matches(DAY)
  validTo?: string;

  @ApiPropertyOptional({ description: 'Clave técnica (facturas); solo escritura' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  technicalKey?: string;

  @ApiProperty({ enum: ['1', '2'] })
  @IsIn(['1', '2'])
  environment: DianEnvironment;
}

export class UpdateResolutionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  rangeTo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DAY)
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(DAY)
  validTo?: string;

  @ApiPropertyOptional({ description: 'Nueva clave técnica (solo escritura)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  technicalKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  resolutionNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
