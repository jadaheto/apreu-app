import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { DATE_REGEX } from './transforms.js';

export class CreateExpenseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiProperty({ example: 'Compra de papelería' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: 120000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: '2026-03-10', description: 'Por defecto hoy' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;

  @ApiPropertyOptional({ description: 'Número de factura o soporte' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  receiptNo?: string;

  @ApiPropertyOptional({ default: 'efectivo' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ListExpensesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Matches(DATE_REGEX, { message: 'La fecha debe tener el formato AAAA-MM-DD.' })
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;
}

export class SaveExpenseCategoryDto {
  @ApiProperty({ example: 'Servicios públicos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;
}
