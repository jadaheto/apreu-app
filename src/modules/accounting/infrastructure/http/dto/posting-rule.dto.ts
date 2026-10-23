import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class SetPostingRuleDto {
  @ApiProperty({ description: 'Cuenta de movimiento a usar para la clave' })
  @IsInt()
  @Min(1)
  accountId: number;
}
