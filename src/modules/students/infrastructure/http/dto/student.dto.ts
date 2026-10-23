import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import {
  BLOOD_TYPES,
  type BloodType,
  GENDERS,
  type Gender,
  STUDENT_DOCUMENT_TYPES,
  STUDENT_STATUSES,
  type StudentDocumentType,
  type StudentStatus,
} from '../../../domain/catalogs.js';
import { GuardianDetailsDto } from './guardian.dto.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Personal data of a student (enrollment form, tab 1 and 3). */
export class StudentDetailsDto {
  @ApiProperty({ example: 'Sofía' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Gómez Ruiz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ enum: STUDENT_DOCUMENT_TYPES, default: 'TI' })
  @IsOptional()
  @IsIn(STUDENT_DOCUMENT_TYPES)
  documentType?: StudentDocumentType;

  @ApiProperty({ example: '1101814264' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  documentNumber: string;

  @ApiPropertyOptional({
    example: '2015-04-20',
    description: 'AAAA-MM-DD, anterior a hoy',
  })
  @IsOptional()
  @Matches(DAY, { message: 'birthDate debe tener formato AAAA-MM-DD' })
  birthDate?: string;

  @ApiPropertyOptional({ enum: GENDERS, default: 'M' })
  @IsOptional()
  @IsIn(GENDERS)
  gender?: Gender;

  @ApiPropertyOptional({ enum: BLOOD_TYPES })
  @IsOptional()
  @IsIn(BLOOD_TYPES)
  bloodType?: BloodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  neighborhood?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Ingrese un correo válido.' })
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eps?: string;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    default: 0,
    description: 'Porcentaje de beca/descuento',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  scholarshipPct?: number;

  @ApiPropertyOptional({
    description: 'Observaciones generales (alergias, condiciones médicas…)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class EnrollStudentDto {
  @ApiProperty({ type: StudentDetailsDto })
  @ValidateNested()
  @Type(() => StudentDetailsDto)
  student: StudentDetailsDto;

  @ApiPropertyOptional({ description: 'Salón del año lectivo vigente' })
  @IsOptional()
  @IsInt()
  @Min(1)
  classroomId?: number;

  @ApiPropertyOptional({
    example: '2026-01-20',
    description: 'Por defecto, hoy',
  })
  @IsOptional()
  @Matches(DAY, { message: 'enrollmentDate debe tener formato AAAA-MM-DD' })
  enrollmentDate?: string;

  @ApiPropertyOptional({
    description: 'Acudiente existente (hermanos). Tiene prioridad sobre `guardian`.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  guardianId?: number;

  @ApiPropertyOptional({
    type: GuardianDetailsDto,
    description: 'Datos del acudiente. Si su documento ya existe, se reutiliza el acudiente registrado.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GuardianDetailsDto)
  guardian?: GuardianDetailsDto;

  @ApiPropertyOptional({
    default: true,
    description: 'Crear/vincular cuentas del portal (estudiante y acudiente)',
  })
  @IsOptional()
  @IsBoolean()
  createPortalAccounts?: boolean;
}

export class UpdateStudentDto extends StudentDetailsDto {
  @ApiPropertyOptional({
    nullable: true,
    type: Number,
    description: 'null quita el salón; omitido lo conserva',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsInt()
  @Min(1)
  classroomId?: number | null;
}

export class ChangeStudentStatusDto {
  @ApiProperty({ enum: STUDENT_STATUSES })
  @IsIn(STUDENT_STATUSES)
  status: StudentStatus;

  @ApiPropertyOptional({ example: 'Traslado a otra institución' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class LinkGuardianDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  guardianId: number;
}

export class ResetPortalPasswordDto {
  @ApiProperty({ enum: ['student', 'guardian'] })
  @IsIn(['student', 'guardian'])
  holder: 'student' | 'guardian';
}

export class VerifyStudentQrDto {
  @ApiProperty({ example: 'APREU1|colegio-demo|15|2026|q1w2e3…' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  rawQr: string;
}

export class ListStudentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STUDENT_STATUSES })
  @IsOptional()
  @IsIn(STUDENT_STATUSES)
  status?: StudentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classroomId?: number;

  @ApiPropertyOptional({
    description: 'Año lectivo del salón (incluye alumnos sin salón)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2999)
  year?: number;
}
