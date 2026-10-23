import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import {
  STICKER_COLORS,
  STICKER_PRIORITIES,
  type StickerColor,
  type StickerPriority,
} from '../../../domain/stickers/employee-sticker.js';
import { STICKER_FILTERS, type StickerFilter } from '../../../domain/stickers/employee-sticker.repository.js';

export class CreateStickerDto {
  @ApiProperty() @IsInt() @Min(1) employeeId: number;
  @ApiProperty({ example: 'Entregar informe de notas' }) @IsString() @IsNotEmpty() @MaxLength(150) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) content?: string;
  @ApiPropertyOptional({ enum: STICKER_COLORS, default: 'yellow' })
  @IsOptional()
  @IsIn(STICKER_COLORS)
  color?: StickerColor;
  @ApiPropertyOptional({ enum: STICKER_PRIORITIES, default: 'normal' })
  @IsOptional()
  @IsIn(STICKER_PRIORITIES)
  priority?: StickerPriority;
}

export class ListStickersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: STICKER_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(STICKER_FILTERS)
  filter?: StickerFilter;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) employeeId?: number;
}
