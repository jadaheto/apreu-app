import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_OBSERVATIONS_LENGTH } from '../../../domain/student-grade.js';

export class GradeSheetQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classroomId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiPropertyOptional({ description: 'Por defecto el período abierto' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId?: number;
}

export class GradeEntryDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, description: 'Cognitivo (60 %)', example: 4.5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  cognitive?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, description: 'Procedimental (30 %)', example: 4 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  procedural?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 5, description: 'Actitudinal (10 %)', example: 5 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  attitudinal?: number | null;

  @ApiPropertyOptional({ maxLength: MAX_OBSERVATIONS_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_OBSERVATIONS_LENGTH)
  observations?: string | null;
}

export class SaveGradeSheetDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  classroomId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiProperty({ description: 'Debe ser el período abierto' })
  @IsInt()
  @Min(1)
  periodId: number;

  @ApiProperty({ type: [GradeEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GradeEntryDto)
  entries: GradeEntryDto[];
}

export class PeriodQueryDto {
  @ApiPropertyOptional({ description: 'Por defecto el último período con notas del año vigente' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId?: number;
}

export class RequiredPeriodQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  periodId: number;
}
