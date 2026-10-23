import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CONCEPT_CATEGORIES, type ConceptCategory } from '../../../domain/concept-category.js';
import { ToBoolean } from './transforms.js';

export class SaveBillingConceptDto {
  @ApiProperty({ example: 'Pensión' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ example: 'PENS01' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  @ApiPropertyOptional({ enum: CONCEPT_CATEGORIES, default: 'pension' })
  @IsOptional()
  @IsIn(CONCEPT_CATEGORIES)
  category?: ConceptCategory;

  @ApiProperty({ example: 350000, description: 'Monto base en pesos' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ example: 0, minimum: 0, maximum: 100, description: '% de IVA' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;
}

export class SetActiveDto {
  @ApiProperty()
  @IsBoolean()
  active: boolean;
}

export class ListConceptsQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por conceptos activos (true) o inactivos (false)' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}
