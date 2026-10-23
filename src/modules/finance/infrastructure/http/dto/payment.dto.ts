import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { PAYMENT_METHODS, type PaymentMethod } from '../../../domain/payment-method.js';
import { PAYMENT_STATUSES, type PaymentStatus } from '../../../domain/payment.js';
import { DATE_REGEX, PERIOD_REGEX } from './transforms.js';

export class RegisterPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId: number;

  @ApiProperty({ example: 350000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-03-15', description: 'Por defecto hoy; no puede ser futura' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  paymentDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Referencia de la transacción' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Cargos a pagar; si se omite se aplica a todos los pendientes del estudiante (más antiguos primero)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  chargeIds?: number[];
}

export class VoidPaymentDto {
  @ApiProperty({ example: 'Pago registrado al estudiante equivocado' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

export class ReconcilePaymentDto {
  @ApiProperty({ example: 'TRX-889922' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankRef: string;
}

export class ListPaymentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-31', description: 'Inclusive' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethod;
}

export class FinanceMonthQueryDto {
  @ApiPropertyOptional({ example: '2026-03', description: 'Por defecto el mes actual' })
  @IsOptional()
  @Matches(PERIOD_REGEX, { message: 'El mes debe tener el formato AAAA-MM.' })
  month?: string;
}
