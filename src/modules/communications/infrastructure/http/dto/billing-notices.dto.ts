import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { BILLING_CHANNELS, type BillingChannel } from '../../../application/billing/send-billing-notices.use-case.js';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export class BillingPreviewQueryDto {
  @ApiProperty({ example: '2026-03' })
  @Matches(MONTH, { message: 'El mes debe tener el formato AAAA-MM.' })
  month: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  conceptId?: number;
}

export class SendBillingNoticesDto extends BillingPreviewQueryDto {
  @ApiProperty({ enum: BILLING_CHANNELS, isArray: true, example: ['email', 'whatsapp'] })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecciona al menos un canal de envío.' })
  @IsIn(BILLING_CHANNELS, { each: true })
  channels: BillingChannel[];

  @ApiPropertyOptional({ description: 'Plantilla de WhatsApp de 5 variables', default: 'cobro_mensual' })
  @IsOptional()
  @Matches(/^[a-z0-9_]{1,100}$/)
  templateName?: string;
}
