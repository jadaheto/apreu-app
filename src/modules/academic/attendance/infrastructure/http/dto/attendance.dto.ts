import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { ISO_DATE_PATTERN } from '../../../../common/infrastructure/http/academic-query.dto.js';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '../../../domain/attendance-record.js';

export class QrAttendanceDto {
  @ApiProperty({
    example: 'APREU1|colegio-demo|15|2026|q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6j7k8l9z0x1c',
    description: 'Texto firmado leído del QR del carnet',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  rawQr: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  classroomId: number;
}

export class ManualAttendanceEntryDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiProperty({ enum: ATTENDANCE_STATUSES })
  @IsIn(ATTENDANCE_STATUSES)
  status: AttendanceStatus;
}

export class ManualAttendanceDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  classroomId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiPropertyOptional({ example: '2026-03-15', description: 'Por defecto hoy' })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'date debe tener el formato AAAA-MM-DD.' })
  date?: string;

  @ApiProperty({ type: [ManualAttendanceEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ManualAttendanceEntryDto)
  entries: ManualAttendanceEntryDto[];
}

export class DailyAttendanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-03-15', description: 'Por defecto hoy' })
  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'date debe tener el formato AAAA-MM-DD.' })
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classroomId?: number;
}

export class AttendanceMonthQueryDto {
  @ApiPropertyOptional({ example: '2026-03', description: 'Por defecto el mes actual' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month debe tener el formato AAAA-MM.' })
  month?: string;
}
