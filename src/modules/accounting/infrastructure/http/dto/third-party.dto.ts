import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { DOCUMENT_TYPES, type DocumentType } from '../../../domain/identity-document.js';
import { ToOptionalBoolean } from './query-transformers.js';

export class ListThirdPartiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToOptionalBoolean()
  @IsBoolean()
  isActive?: boolean;
}

export class ThirdPartyDto {
  @ApiProperty({ enum: DOCUMENT_TYPES, default: 'CC' })
  @IsIn(DOCUMENT_TYPES)
  documentType: DocumentType;

  @ApiProperty({ example: '900123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  documentNumber: string;

  @ApiPropertyOptional({ description: 'Dígito de verificación (NIT). Se calcula si se omite.' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  dv?: string;

  @ApiProperty({ example: 'Papelería El Lápiz S.A.S.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

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
}
