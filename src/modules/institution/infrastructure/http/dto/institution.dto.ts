import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { INSTITUTION_PERSON_TYPES, type InstitutionPersonType } from '../../../domain/institution-profile.js';
import { INSTITUTION_DOCUMENT_TYPES, type InstitutionDocumentType } from '../../../domain/nit.js';

/** Full replacement of the institution data (formats are validated by the domain). */
export class UpdateInstitutionProfileDto {
  @ApiProperty({ example: 'Colegio San José S.A.S.' })
  @IsString()
  @IsNotEmpty({ message: 'La razón social es obligatoria.' })
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: '900123456', description: 'Sin DV o con DV (900.123.456-8); el DV se calcula' })
  @IsString()
  @IsNotEmpty({ message: 'El NIT es obligatorio.' })
  @MaxLength(20)
  nit: string;

  @ApiProperty({ enum: INSTITUTION_DOCUMENT_TYPES })
  @IsIn(INSTITUTION_DOCUMENT_TYPES)
  documentType: InstitutionDocumentType;

  @ApiProperty({ enum: INSTITUTION_PERSON_TYPES })
  @IsIn(INSTITUTION_PERSON_TYPES)
  personType: InstitutionPersonType;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) address?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string | null;
  @ApiPropertyOptional({ example: '001' }) @IsOptional() @IsString() @MaxLength(5) cityDaneCode?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) department?: string | null;
  @ApiPropertyOptional({ example: '11' }) @IsOptional() @IsString() @MaxLength(2) departmentDaneCode?: string | null;
  @ApiPropertyOptional({ example: '110111' }) @IsOptional() @IsString() @MaxLength(6) postalCode?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['O-13', 'O-15'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  taxResponsibilities?: string[];

  @ApiPropertyOptional({ description: 'Código DANE de la institución' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  daneCode?: string | null;

  @ApiPropertyOptional({ description: 'Resolución de aprobación' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  resolutionNumber?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) rectorName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) billingContactName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) billingContactPhone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) billingContactEmail?: string | null;
}

export class BillingContactDto {
  @ApiProperty({ nullable: true, type: String }) name: string | null;
  @ApiProperty({ nullable: true, type: String }) phone: string | null;
  @ApiProperty({ nullable: true, type: String }) email: string | null;
}

export class InstitutionProfileResponseDto {
  @ApiProperty({ nullable: true, type: Number }) id: number | null;
  @ApiProperty() name: string;
  @ApiProperty() nit: string;
  @ApiProperty({ nullable: true, type: Number }) nitDv: number | null;
  @ApiProperty({ example: '900123456-8' }) nitFormatted: string;
  @ApiProperty({ enum: INSTITUTION_DOCUMENT_TYPES }) documentType: string;
  @ApiProperty({ enum: INSTITUTION_PERSON_TYPES }) personType: string;
  @ApiProperty({ nullable: true, type: String }) address: string | null;
  @ApiProperty({ nullable: true, type: String }) phone: string | null;
  @ApiProperty({ nullable: true, type: String }) email: string | null;
  @ApiProperty({ nullable: true, type: String }) city: string | null;
  @ApiProperty({ nullable: true, type: String }) cityDaneCode: string | null;
  @ApiProperty({ nullable: true, type: String }) department: string | null;
  @ApiProperty({ nullable: true, type: String }) departmentDaneCode: string | null;
  @ApiProperty({ nullable: true, type: String }) postalCode: string | null;
  @ApiProperty({ type: [String] }) taxResponsibilities: string[];
  @ApiProperty({ nullable: true, type: String }) daneCode: string | null;
  @ApiProperty({ nullable: true, type: String }) resolutionNumber: string | null;
  @ApiProperty({ nullable: true, type: String }) rectorName: string | null;
  @ApiProperty({ type: BillingContactDto }) billingContact: BillingContactDto;
  @ApiProperty({ nullable: true, type: String, example: '/api/institution/logo' }) logoUrl: string | null;
}

export class PublicBrandingResponseDto {
  @ApiProperty() schoolName: string;
  @ApiProperty({ nullable: true, type: String }) logoUrl: string | null;
  @ApiProperty() logoSize: number;
  @ApiProperty({ example: '#4f46e5' }) colorPrimary: string;
  @ApiProperty({ example: '#ffffff' }) colorHeaderBg: string;
  @ApiProperty({ example: '#4f46e5' }) colorHeaderBar: string;
  @ApiProperty({ example: 2026 }) academicYear: number;
}

/** Subset of the Multer file used by the upload endpoint (memory storage). */
export interface UploadedImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}
