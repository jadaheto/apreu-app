import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { DAY_MESSAGE, DAY_REGEX } from './query-transformers.js';

export class CreateAccountingPeriodDto {
  @ApiProperty({ example: 'Enero 2026' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '2026-01-01' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  startDate: string;

  @ApiProperty({ example: '2026-01-31' })
  @Matches(DAY_REGEX, { message: DAY_MESSAGE })
  endDate: string;
}

export class ReasonDto {
  @ApiProperty({ example: 'Ajuste de causación solicitado por revisoría fiscal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}
