import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import {
  MAX_NOTIFICATION_MESSAGE,
  NOTIFICATION_TYPES,
  type NotificationType,
} from '../../../domain/notifications/notification.js';

export class MyNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  unreadOnly?: boolean;
}

export class CreateNotificationsDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  userIds: number[];

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ maxLength: MAX_NOTIFICATION_MESSAGE })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NOTIFICATION_MESSAGE)
  message: string;

  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES, default: 'info' })
  @IsOptional()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;
}
