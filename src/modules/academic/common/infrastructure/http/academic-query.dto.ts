import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR } from '../../domain/academic-year.js';

/** `?year=` filter; defaults to `settings.academic_year`. */
export class AcademicYearQueryDto {
  @ApiPropertyOptional({ description: 'Año lectivo (por defecto el configurado en el colegio)', example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  year?: number;
}

/** Day in `YYYY-MM-DD` format. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
