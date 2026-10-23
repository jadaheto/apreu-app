import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import type { StockAlertFilter } from '../../../domain/inventory-item.repository.js';
import { MANUAL_MOVEMENT_TYPES, type ManualMovementType } from '../../../domain/stock-movement.js';

const ALERTS: StockAlertFilter[] = ['any', 'low', 'out'];

export class ListItemsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @ApiPropertyOptional({ enum: ALERTS, description: 'any = stock ≤ mínimo; low = 0 < stock ≤ mínimo; out = sin stock' })
  @IsOptional()
  @IsIn(ALERTS)
  alert?: StockAlertFilter;

  @ApiPropertyOptional({ description: 'Incluye ítems desactivados' })
  @IsOptional()
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj.includeInactive === undefined ? undefined : obj.includeInactive === 'true' || obj.includeInactive === true,
  )
  @IsBoolean()
  includeInactive?: boolean;
}

export class ItemDto {
  @ApiProperty({ example: 'Camiseta uniforme talla 10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'UNI-CAM-10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  sku: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  categoryId?: number | null;

  @ApiPropertyOptional({ default: 'und', example: 'und' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice: number;

  @ApiProperty({ minimum: 0, default: 5 })
  @IsInt()
  @Min(0)
  minStock: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;
}

export class CreateItemDto extends ItemDto {
  @ApiPropertyOptional({ minimum: 0, default: 0, description: 'Se registra como movimiento "inicial"' })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;
}

export class StockMovementDto {
  @ApiProperty({ enum: MANUAL_MOVEMENT_TYPES })
  @IsIn(MANUAL_MOVEMENT_TYPES)
  type: ManualMovementType;

  @ApiProperty({ description: 'Unidades (entrada/salida) o stock contado (ajuste)' })
  @IsInt()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional({ description: 'Costo unitario de compra (sólo entradas; recalcula el costo promedio)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}

export class CategoryDto {
  @ApiProperty({ example: 'Uniformes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;
}
