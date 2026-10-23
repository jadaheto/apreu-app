import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { MAX_CHAT_MESSAGE } from '../../../domain/ai/chat-exchange.js';
import {
  MARKETING_TYPES,
  MAX_MARKETING_CONTEXT,
  MIN_MARKETING_CONTEXT,
  type MarketingType,
} from '../../../domain/ai/marketing-generation.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class AskAssistantDto {
  @ApiProperty({ maxLength: MAX_CHAT_MESSAGE })
  @IsString()
  @IsNotEmpty({ message: 'El mensaje no puede estar vacío.' })
  @MaxLength(MAX_CHAT_MESSAGE)
  message: string;
}

export class ChatLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'student' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  role?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @Matches(DAY)
  to?: string;
}

export class GenerateMarketingDto {
  @ApiProperty({ enum: MARKETING_TYPES })
  @IsIn(MARKETING_TYPES)
  type: MarketingType;

  @ApiProperty({
    minLength: MIN_MARKETING_CONTEXT,
    maxLength: MAX_MARKETING_CONTEXT,
    description: 'Tema / objetivo específico',
  })
  @IsString()
  @MinLength(MIN_MARKETING_CONTEXT)
  @MaxLength(MAX_MARKETING_CONTEXT)
  context: string;
}

export class MarketingHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MARKETING_TYPES })
  @IsOptional()
  @IsIn(MARKETING_TYPES)
  type?: MarketingType;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @Matches(DAY)
  date?: string;
}
