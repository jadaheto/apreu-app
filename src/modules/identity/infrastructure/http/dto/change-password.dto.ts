import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  currentPassword: string;

  @ApiProperty({ description: 'Mínimo 8 caracteres con letras y números' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  newPassword: string;
}
