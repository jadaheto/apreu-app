import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../../../shared/domain/role.js';
import { Permission } from '../../../domain/access-policy.js';

export class NavigationItemDto {
  @ApiProperty({ example: 'users' }) key: string;
  @ApiProperty({ example: 'Usuarios' }) label: string;
  @ApiProperty({ example: '/admin/users' }) route: string;
  @ApiProperty({ example: 'key', description: 'Nombre del ícono Heroicons (outline)' }) icon: string;
}

export class SessionPolicyDto {
  @ApiProperty({ description: 'Segundos de inactividad tras los que el cliente debe cerrar la sesión' })
  idleTimeoutSeconds: number;
}

export class MyPermissionsResponseDto {
  @ApiProperty({ enum: Role }) role: Role;
  @ApiProperty({ enum: ['admin', 'employee', 'student'] }) portal: string;
  @ApiProperty({ enum: Permission, isArray: true }) permissions: Permission[];
  @ApiProperty({ type: [NavigationItemDto], description: 'Módulos accesibles, en orden de menú' })
  modules: NavigationItemDto[];
  @ApiProperty({ type: SessionPolicyDto }) session: SessionPolicyDto;
}

export class RefreshSessionResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ description: 'Vigencia del token en segundos' }) expiresIn: number;
  @ApiProperty() idleTimeoutSeconds: number;
}
