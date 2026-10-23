import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { WHATSAPP_STATUSES, type WhatsAppStatus } from '../../../domain/whatsapp/whatsapp-log.js';
import {
  HEADER_TYPES,
  type HeaderType,
  MAX_BODY_LENGTH,
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUSES,
  type TemplateButton,
  type TemplateCategory,
  type TemplateStatus,
} from '../../../domain/whatsapp/whatsapp-template.js';

export class SendWhatsAppMessageDto {
  @ApiProperty({ example: '573001234567', description: '57 + 10 dígitos, o 10 dígitos' })
  @IsString()
  @IsNotEmpty({ message: 'Número y plantilla son obligatorios.' })
  @MaxLength(25)
  phone: string;

  @ApiProperty({ example: 'cobro_mensual' })
  @IsString()
  @IsNotEmpty({ message: 'Número y plantilla son obligatorios.' })
  @MaxLength(100)
  templateName: string;

  @ApiProperty({ type: [String], description: 'Valores de {{1}}..{{n}} en orden' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(1024, { each: true })
  variables: string[];
}

export class NotifyEventDto {
  @ApiProperty({ example: '2026-04-10' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Fecha y nombre del evento son requeridos.' })
  date: string;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: 'Fecha y nombre del evento son requeridos.' })
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ maxLength: 600 })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  details?: string;
}

export class WhatsAppLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WHATSAPP_STATUSES })
  @IsOptional()
  @IsIn(WHATSAPP_STATUSES)
  status?: WhatsAppStatus;
}

export class TemplatesQueryDto {
  @ApiPropertyOptional({ enum: TEMPLATE_STATUSES })
  @IsOptional()
  @IsIn(TEMPLATE_STATUSES)
  status?: TemplateStatus;
}

export class WhatsAppTemplateDto {
  @ApiProperty({ example: 'cobro_mensual', description: 'Minúsculas, números y guion bajo' })
  @Matches(/^[a-z0-9_]{1,100}$/, { message: 'El nombre solo admite minúsculas, números y guion bajo.' })
  name: string;

  @ApiPropertyOptional({ description: 'ID de la plantilla en Meta' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  metaTemplateId?: string;

  @ApiProperty({ example: 'es_CO' })
  @Matches(/^[a-z]{2}(_[A-Z]{2})?$/)
  language: string;

  @ApiProperty({ enum: TEMPLATE_CATEGORIES })
  @IsIn(TEMPLATE_CATEGORIES)
  category: TemplateCategory;

  @ApiProperty({ maxLength: MAX_BODY_LENGTH, description: 'Use {{1}}, {{2}}, ... para las variables' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_BODY_LENGTH)
  body: string;

  @ApiProperty({ type: [String], description: 'Una etiqueta por variable, en orden' })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  variables: string[];

  @ApiProperty({ enum: TEMPLATE_STATUSES })
  @IsIn(TEMPLATE_STATUSES)
  status: TemplateStatus;

  @ApiProperty({ enum: HEADER_TYPES, default: 'none' })
  @IsIn(HEADER_TYPES)
  headerType: HeaderType;

  @ApiPropertyOptional({ maxLength: 60 })
  @ValidateIf((dto: WhatsAppTemplateDto) => dto.headerType === 'text')
  @IsString()
  @MaxLength(60)
  headerText?: string;

  @ApiPropertyOptional({ description: 'URL https de la imagen del encabezado' })
  @ValidateIf((dto: WhatsAppTemplateDto) => dto.headerType === 'image')
  @IsString()
  @MaxLength(1000)
  headerImageUrl?: string;

  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  footerText?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' }, description: 'Botones estáticos (JSON de Meta)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsObject({ each: true })
  buttons?: TemplateButton[];
}
