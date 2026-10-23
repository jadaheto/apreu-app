import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CERTIFICATE_TYPES, type CertificateType } from '../../../domain/certificate.js';

/** Body to issue (admin) or request (owner) a certificate. */
export class CertificateRequestDto {
  @ApiPropertyOptional({
    enum: CERTIFICATE_TYPES,
    default: 'certificado_estudiantil',
  })
  @IsOptional()
  @IsIn(CERTIFICATE_TYPES)
  type?: CertificateType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelCertificateDto {
  @ApiProperty({ example: 'Expedido por error' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
