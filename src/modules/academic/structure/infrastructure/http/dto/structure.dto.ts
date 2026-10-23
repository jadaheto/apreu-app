import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR } from '../../../../common/domain/academic-year.js';
import { EDUCATION_LEVELS, type EducationLevel } from '../../../domain/grade.js';

export class GradeDto {
  @ApiProperty({ example: 'Primero', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: EDUCATION_LEVELS, default: 'primaria' })
  @IsOptional()
  @IsIn(EDUCATION_LEVELS)
  level?: EducationLevel;
}

export class SubjectDto {
  @ApiProperty({ example: 'Matemáticas', maxLength: 150 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'MAT01', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Ciencias', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  area?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 1, description: 'Intensidad horaria semanal' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  hoursPerWeek?: number;
}

class ClassroomFieldsDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  gradeId: number;

  @ApiProperty({ example: '5A', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;
}

export class CreateClassroomDto extends ClassroomFieldsDto {
  @ApiPropertyOptional({ description: 'Por defecto el año lectivo vigente', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  academicYear?: number;
}

export class UpdateClassroomDto extends ClassroomFieldsDto {
  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  academicYear: number;
}

export class AssignDirectorDto {
  @ApiProperty({ type: Number, nullable: true, description: 'Empleado director; null quita el director actual' })
  @ValidateIf((dto: AssignDirectorDto) => dto.employeeId !== null)
  @IsInt()
  @Min(1)
  employeeId: number | null;
}

export class CreateAssignmentDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  employeeId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  subjectId: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  classroomId: number;
}

export class ChangeAssignmentTeacherDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  employeeId: number;
}
