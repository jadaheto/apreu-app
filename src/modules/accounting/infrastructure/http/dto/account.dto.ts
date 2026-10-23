import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { ACCOUNT_TYPES, type AccountType } from '../../../domain/account-type.js';
import { ToOptionalBoolean } from './query-transformers.js';

export class ListAccountsQueryDto {
  @ApiPropertyOptional({ description: 'Devuelve el PUC jerárquico' })
  @IsOptional()
  @ToOptionalBoolean()
  @IsBoolean()
  tree?: boolean;

  @ApiPropertyOptional({ description: 'true = sólo cuentas de movimiento; false = sólo mayores' })
  @IsOptional()
  @ToOptionalBoolean()
  @IsBoolean()
  transactional?: boolean;

  @ApiPropertyOptional({ description: 'Prefijo de código o parte del nombre' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateAccountDto {
  @ApiProperty({ example: '110505', description: 'Código PUC numérico (1, 2, 4, 6 u 8+ dígitos)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Caja General' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ enum: ACCOUNT_TYPES, description: 'Se deriva del primer dígito si se omite' })
  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  type?: AccountType;

  @ApiProperty({ description: '¿Recibe movimientos? (cuenta auxiliar)' })
  @IsBoolean()
  isTransactional: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    description: 'Cuenta padre. Omitido = se infiere por prefijo; null = raíz',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  parentId?: number | null;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isTransactional?: boolean;
}
