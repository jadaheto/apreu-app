import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export class TuitionRateDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeId: number;

  @ApiPropertyOptional({ nullable: true, type: Number, description: 'Vacío o null = tarifa "General" del grado' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conceptId?: number | null;

  @ApiProperty({ example: 380000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;
}

export class SaveTuitionScheduleDto {
  @ApiProperty({ type: [TuitionRateDto] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => TuitionRateDto)
  rates: TuitionRateDto[];
}

export class TuitionQueryDto {
  @ApiPropertyOptional({ description: 'Año académico; por defecto el configurado' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}
