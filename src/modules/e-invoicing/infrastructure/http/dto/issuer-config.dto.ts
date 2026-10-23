import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** Partial update of the issuer configuration. `softwarePin` is write-only. */
export class UpdateIssuerConfigDto {
  @ApiPropertyOptional({ example: 'Colegio San José SAS' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({ example: '900123456', description: 'NIT sin dígito de verificación' })
  @IsOptional()
  @Matches(/^\d{5,15}$/)
  nit?: string;

  @ApiPropertyOptional({ enum: ['1', '2'], description: '1 persona jurídica, 2 persona natural' })
  @IsOptional()
  @IsIn(['1', '2'])
  personType?: '1' | '2';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  familyName?: string;

  @ApiPropertyOptional({ example: 'O-13;O-15', description: 'Responsabilidades fiscales del RUT' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxResponsibilities?: string;

  @ApiPropertyOptional({ enum: ['48', '49'], description: '48 responsable de IVA, 49 no responsable' })
  @IsOptional()
  @IsIn(['48', '49'])
  vatRegime?: '48' | '49';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: '70001', description: 'Código DANE del municipio' })
  @IsOptional()
  @Matches(/^\d{5}$/)
  cityCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ description: 'Identificador del software asignado por la DIAN' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  softwareId?: string;

  @ApiPropertyOptional({ description: 'PIN del software (solo escritura; vacío conserva el actual)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  softwarePin?: string;

  @ApiPropertyOptional({ enum: ['1', '2'], description: '1 producción, 2 habilitación' })
  @IsOptional()
  @IsIn(['1', '2'])
  environment?: '1' | '2';

  @ApiPropertyOptional({ description: 'TestSetId de habilitación' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  testSetId?: string;

  @ApiPropertyOptional({ description: 'Emitir factura automáticamente al registrar pagos en cartera' })
  @IsOptional()
  @IsBoolean()
  autoInvoiceOnPayment?: boolean;

  @ApiPropertyOptional({ enum: ['annex', 'legacy'] })
  @IsOptional()
  @IsIn(['annex', 'legacy'])
  fileNaming?: 'annex' | 'legacy';

  @ApiPropertyOptional({ example: '000', description: 'Código de proveedor tecnológico (000 = software propio)' })
  @IsOptional()
  @Matches(/^\d{3}$/)
  providerCode?: string;
}
