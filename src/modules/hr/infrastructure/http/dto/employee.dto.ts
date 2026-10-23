import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import {
  BANK_ACCOUNT_TYPES,
  CONTRACT_TYPES,
  DOCUMENT_TYPES,
  EMPLOYEE_STATUSES,
  EMPLOYEE_TYPES,
  GENDERS,
  type BankAccountType,
  type ContractType,
  type DocumentType,
  type EmployeeStatus,
  type EmployeeType,
  type Gender,
} from '../../../domain/employees/employee-catalogs.js';
import type { EmployeeData } from '../../../domain/employees/employee.js';

const MONEY = { maxDecimalPlaces: 2 } as const;

/** Employee form (personal data, contract, bank, social security, deductions, withholding). */
export class EmployeeDataDto implements EmployeeData {
  @ApiProperty({ example: 'Ana María' }) @IsString() @IsNotEmpty() @MaxLength(100) firstName: string;
  @ApiProperty({ example: 'Pérez Gómez' }) @IsString() @IsNotEmpty() @MaxLength(100) lastName: string;
  @ApiProperty({ enum: DOCUMENT_TYPES }) @IsIn(DOCUMENT_TYPES) documentType: DocumentType;
  @ApiProperty({ example: '1012345678' }) @IsString() @IsNotEmpty() @MaxLength(30) documentNumber: string;
  @ApiPropertyOptional({ example: '1990-05-20' }) @IsOptional() @IsISO8601({ strict: true }) birthDate?: string | null;
  @ApiProperty({ enum: GENDERS }) @IsIn(GENDERS) gender: Gender;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(150) email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string | null;
  @ApiProperty({ enum: EMPLOYEE_TYPES }) @IsIn(EMPLOYEE_TYPES) employeeType: EmployeeType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) position?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) department?: string | null;
  @ApiPropertyOptional({ example: '2026-01-15' }) @IsOptional() @IsISO8601({ strict: true }) hireDate?: string | null;
  @ApiProperty({ enum: CONTRACT_TYPES, description: '`prestacion` = contratista, no entra a nómina' })
  @IsIn(CONTRACT_TYPES)
  contractType: ContractType;
  @ApiProperty({ example: 2500000 }) @IsNumber(MONEY) @Min(1) baseSalary: number;
  @ApiPropertyOptional({ description: 'Salario integral (≥ 13 SMMLV)' })
  @IsOptional()
  @IsBoolean()
  integralSalary?: boolean;
  @ApiPropertyOptional({ description: 'Libranza mensual' })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  fixedLibranza?: number;
  @ApiPropertyOptional({ description: 'Cuota sindical mensual' })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  fixedSindicato?: number;
  @ApiPropertyOptional({ description: 'Embargo mensual' }) @IsOptional() @IsNumber(MONEY) @Min(0) fixedEmbargo?: number;
  @ApiPropertyOptional({ description: 'Embargo por alimentos (tope 50 %)' })
  @IsOptional()
  @IsBoolean()
  embargoIsAlimony?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) bankName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) bankAccount?: string | null;
  @ApiPropertyOptional({ enum: BANK_ACCOUNT_TYPES })
  @IsOptional()
  @IsIn(BANK_ACCOUNT_TYPES)
  accountType?: BankAccountType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) eps?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) pensionFund?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) arl?: string | null;
  @ApiPropertyOptional({ minimum: 1, maximum: 5, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  arlRiskClass?: number;
  @ApiPropertyOptional({ description: 'Tiene dependientes (retención)' })
  @IsOptional()
  @IsBoolean()
  withholdingDependents?: boolean;
  @ApiPropertyOptional({ description: 'Medicina prepagada mensual' })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  withholdingPrepaidHealth?: number;
  @ApiPropertyOptional({ description: 'Intereses de vivienda mensuales' })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  withholdingHousingInterest?: number;
  @ApiPropertyOptional({ description: 'Aportes voluntarios a pensión/AFC mensuales' })
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0)
  voluntaryPension?: number;
}

export class RegisterEmployeeDto extends EmployeeDataDto {
  @ApiPropertyOptional({ default: true, description: 'Crear o vincular la cuenta de usuario del portal' })
  @IsOptional()
  @IsBoolean()
  createUserAccount?: boolean;
}

export class ChangeEmployeeStatusDto {
  @ApiProperty({ enum: EMPLOYEE_STATUSES.filter((s) => s !== 'retired') })
  @IsIn(EMPLOYEE_STATUSES.filter((s) => s !== 'retired'))
  status: EmployeeStatus;
}

export class RetireEmployeeDto {
  @ApiProperty({ example: '2026-03-31' }) @IsISO8601({ strict: true }) retirementDate: string;
  @ApiProperty({ example: 'Renuncia voluntaria' }) @IsString() @IsNotEmpty() @MaxLength(255) reason: string;
}

export class ListEmployeesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EMPLOYEE_TYPES }) @IsOptional() @IsIn(EMPLOYEE_TYPES) type?: EmployeeType;
  @ApiPropertyOptional({ enum: EMPLOYEE_STATUSES }) @IsOptional() @IsIn(EMPLOYEE_STATUSES) status?: EmployeeStatus;
}

export class IssueCertificateDto {
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() includeSalary?: boolean;
  @ApiPropertyOptional({ example: 'A quien pueda interesar' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  addressee?: string;
}

export class YearQueryDto {
  @ApiProperty({ example: 2025 }) @Type(() => Number) @IsInt() @Min(2000) @Max(2100) year: number;
}
