import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Role } from '../../../../../shared/domain/role.js';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { ToBoolean } from './query-transforms.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'Rol inválido.' })
  role?: Role;

  @ApiPropertyOptional({ description: 'Filtra por cuentas activas (true) o inactivas (false)' })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Ana Pérez' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'ana.perez@colegio.edu.co' })
  @IsEmail({}, { message: 'Ingrese un correo válido.' })
  @MaxLength(150)
  email: string;

  @ApiProperty({ enum: Role, default: Role.EMPLOYEE })
  @IsEnum(Role, { message: 'Rol inválido.' })
  role: Role;
}

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: 'Ingrese un correo válido.' })
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role, { message: 'Rol inválido.' })
  role?: Role;
}

export class ChangeUserStatusDto {
  @ApiProperty({ description: 'true activa la cuenta, false la desactiva' })
  @IsBoolean()
  active: boolean;
}

export class ManagedUserResponseDto {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({ nullable: true, type: String }) avatar: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() mustChangePassword: boolean;
  @ApiProperty({ nullable: true, type: Date }) lastLogin: Date | null;
  @ApiProperty({ nullable: true, type: Date }) createdAt: Date | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Estado laboral del empleado vinculado (docentes/empleados)',
  })
  employmentStatus: string | null;
  @ApiProperty({ enum: ['active', 'inactive', 'suspended', 'retired', 'on_leave'] }) effectiveStatus: string;
}

export class UserWithTemporaryPasswordResponseDto {
  @ApiProperty({ type: ManagedUserResponseDto }) user: ManagedUserResponseDto;
  @ApiProperty({ description: 'Contraseña temporal; se muestra una sola vez y debe cambiarse al iniciar sesión' })
  temporaryPassword: string;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({ type: [ManagedUserResponseDto] }) items: ManagedUserResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class UserStatsResponseDto {
  @ApiProperty() total: number;
  @ApiProperty({ description: 'superadmin + admin' }) admins: number;
  @ApiProperty({ description: 'docentes, empleados, RRHH y finanzas' }) staff: number;
  @ApiProperty({ description: 'estudiantes y acudientes' }) families: number;
  @ApiProperty() inactive: number;
}
