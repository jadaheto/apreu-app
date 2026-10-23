import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { DAY_PATTERN, ToBoolean } from './query-transforms.js';

export class AccessLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  userId?: number;

  @ApiPropertyOptional({ example: 'auth' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  module?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  allowed?: boolean;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: 'Fecha inválida (AAAA-MM-DD).' })
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @Matches(DAY_PATTERN, { message: 'Fecha inválida (AAAA-MM-DD).' })
  to?: string;
}

export class AccessLogRecordDto {
  @ApiProperty() id: number;
  @ApiProperty() userId: number;
  @ApiProperty({ nullable: true, type: String }) userName: string | null;
  @ApiProperty({ nullable: true, type: String }) userEmail: string | null;
  @ApiProperty() role: string;
  @ApiProperty() path: string;
  @ApiProperty() module: string;
  @ApiProperty() allowed: boolean;
  @ApiProperty() ipAddress: string;
  @ApiProperty({ nullable: true, type: Date }) createdAt: Date | null;
}

export class PaginatedAccessLogResponseDto {
  @ApiProperty({ type: [AccessLogRecordDto] }) items: AccessLogRecordDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
