import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../../shared/domain/role.js';

export class UserResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({ nullable: true, type: String }) avatar: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true, type: Date }) lastLogin: Date | null;
  @ApiProperty({ enum: ['admin', 'employee', 'student'], description: 'Portal al que se redirige tras el login' })
  portal: string;
  @ApiProperty({ description: 'Debe cambiar la contraseña temporal antes de continuar' }) mustChangePassword: boolean;
}

export class LoginResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ description: 'Vigencia del token en segundos' }) expiresIn: number;
  @ApiProperty({ type: UserResponseDto }) user: UserResponseDto;
}
