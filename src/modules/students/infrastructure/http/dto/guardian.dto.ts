import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  GUARDIAN_DOCUMENT_TYPES,
  type GuardianDocumentType,
  RELATIONSHIPS,
  type Relationship,
} from '../../../domain/catalogs.js';

/** Legal guardian data (enrollment form, tab 2). */
export class GuardianDetailsDto {
  @ApiPropertyOptional({ enum: GUARDIAN_DOCUMENT_TYPES, default: 'cc' })
  @IsOptional()
  @IsIn(GUARDIAN_DOCUMENT_TYPES)
  documentType?: GuardianDocumentType;

  @ApiProperty({ example: '52123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  documentNumber: string;

  @ApiProperty({ example: 'Marta' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Ruiz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ enum: RELATIONSHIPS, default: 'padre' })
  @IsOptional()
  @IsIn(RELATIONSHIPS)
  relationship?: Relationship;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional({
    description: 'Necesario para crear la cuenta del portal',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Ingrese un correo válido.' })
  @MaxLength(150)
  email?: string;

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
  occupation?: string;
}

export class FindGuardianQueryDto {
  @ApiProperty({ example: '52123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  documentNumber: string;
}
