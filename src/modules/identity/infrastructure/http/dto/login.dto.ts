import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'director@colegio.edu.co' })
  // Pasted e-mails often carry spaces; the legacy login trimmed them (the use case lower-cases).
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Ingrese un correo válido.' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty({ message: 'Ingrese su contraseña.' })
  @MaxLength(255)
  password: string;
}
