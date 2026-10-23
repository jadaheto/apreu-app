import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR } from '../../../../common/domain/academic-year.js';
import { ISO_DATE_PATTERN } from '../../../../common/infrastructure/http/academic-query.dto.js';

export class UpdatePeriodDto {
  @ApiProperty({ example: 'Primer Período', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({ example: '2026-02-01' })
  @Matches(ISO_DATE_PATTERN, { message: 'startDate debe tener el formato AAAA-MM-DD.' })
  startDate: string;

  @ApiProperty({ example: '2026-04-15' })
  @Matches(ISO_DATE_PATTERN, { message: 'endDate debe tener el formato AAAA-MM-DD.' })
  endDate: string;
}

export class CreateAcademicPeriodDto extends UpdatePeriodDto {
  @ApiPropertyOptional({ description: 'Por defecto el año lectivo vigente', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  academicYear?: number;
}
