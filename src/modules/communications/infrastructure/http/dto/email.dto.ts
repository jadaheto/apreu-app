import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { AUDIENCE_KINDS, type AudienceKind } from '../../../domain/email/audience.js';
import { EMAIL_STATUSES, EMAIL_TYPES, type EmailStatus, type EmailType } from '../../../domain/email/email-log.js';

/** Multipart fields of `POST /communications/email/notices` (files go in `attachments`). */
export class SendNoticeDto {
  @ApiProperty({ enum: AUDIENCE_KINDS, default: 'all_parents' })
  @IsIn(AUDIENCE_KINDS)
  audience: AudienceKind;

  @ApiPropertyOptional({ description: 'Obligatorio si audience = by_grade' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  gradeId?: number;

  @ApiPropertyOptional({ description: 'Obligatorio si audience = by_classroom' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  classroomId?: number;

  @ApiPropertyOptional({ description: 'Correos separados por coma (audience = manual)' })
  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  manualEmails?: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty({ message: 'Asunto y mensaje son obligatorios.' })
  @MaxLength(255)
  subject: string;

  @ApiProperty({ description: 'Cuerpo HTML del editor (se sanea en el servidor)' })
  @IsString()
  @IsNotEmpty({ message: 'Asunto y mensaje son obligatorios.' })
  @MaxLength(200_000)
  bodyHtml: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Hasta 5 archivos de 10 MB: pdf, doc, docx, xls, xlsx, jpg, png, gif',
  })
  attachments?: unknown;
}

export class EmailLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EMAIL_TYPES })
  @IsOptional()
  @IsIn(EMAIL_TYPES)
  type?: EmailType;

  @ApiPropertyOptional({ enum: EMAIL_STATUSES })
  @IsOptional()
  @IsIn(EMAIL_STATUSES)
  status?: EmailStatus;
}

export class SmtpTestDto {
  @ApiPropertyOptional({ enum: ['general', 'invoicing'], default: 'general' })
  @IsOptional()
  @IsIn(['general', 'invoicing'])
  profile?: 'general' | 'invoicing';
}

export class UploadEmailImageDto {
  @ApiProperty({ enum: ['logo', 'promo'] })
  @IsIn(['logo', 'promo'], { message: 'Tipo inválido. Usa "logo" o "promo".' })
  type: 'logo' | 'promo';

  @ApiProperty({ type: 'string', format: 'binary', description: 'PNG, JPG, GIF o WebP de máximo 2 MB' })
  image?: unknown;
}
