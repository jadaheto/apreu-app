import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import type { JournalEntryStatus } from '../../../domain/journal-entry.js';
import { VOUCHER_TYPES, type VoucherType } from '../../../domain/voucher-type.js';
import { DAY_MESSAGE, DAY_REGEX } from './query-transformers.js';
import { ReasonDto } from './period.dto.js';

export class JournalLineDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  accountId: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  thirdPartyId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit?: number;
}

export class JournalEntryDto {
  @ApiPropertyOptional({ description: 'Si se omite se usa el periodo abierto que contiene la fecha' })
  @IsOptional()
  @IsInt()
  @Min(1)
  periodId?: number;

  @ApiProperty({ example: '2026-03-15' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  date: string;

  @ApiProperty({ enum: VOUCHER_TYPES })
  @IsIn(VOUCHER_TYPES)
  type: VoucherType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  description: string;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

export class CreateJournalEntryDto extends JournalEntryDto {
  @ApiPropertyOptional({ default: true, description: 'false = guardar como borrador' })
  @IsOptional()
  @IsBoolean()
  postImmediately?: boolean;
}

export class ListJournalEntriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  to?: string;

  @ApiPropertyOptional({ enum: VOUCHER_TYPES })
  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  type?: VoucherType;

  @ApiPropertyOptional({ enum: ['draft', 'posted', 'voided'] })
  @IsOptional()
  @IsIn(['draft', 'posted', 'voided'])
  status?: JournalEntryStatus;
}

export class ReverseJournalEntryDto extends ReasonDto {
  @ApiPropertyOptional({ description: 'Fecha del contra-asiento (por defecto hoy)' })
  @IsOptional()
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  date?: string;

  @ApiPropertyOptional({ enum: VOUCHER_TYPES, default: 'NI' })
  @IsOptional()
  @IsIn(VOUCHER_TYPES)
  type?: VoucherType;
}
