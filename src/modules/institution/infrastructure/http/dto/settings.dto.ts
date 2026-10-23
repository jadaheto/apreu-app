import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateSettingsSectionDto {
  @ApiProperty({
    description: 'Claves de la sección a modificar. null borra; un secreto enviado como "••••••••" no se modifica.',
    example: { color_primary: '#4f46e5', logo_size: 48 },
  })
  @IsObject()
  values: Record<string, unknown>;
}

export class SettingFieldDto {
  @ApiProperty() key: string;
  @ApiProperty() label: string;
  @ApiProperty({
    enum: ['text', 'integer', 'decimal', 'boolean', 'enum', 'enum-set', 'hex-color', 'email', 'url', 'date'],
  })
  type: string;
  @ApiProperty() secret: boolean;
  @ApiProperty() readOnly: boolean;
  @ApiProperty({ nullable: true, type: [String] }) options: string[] | null;
  @ApiProperty({ nullable: true, type: Number }) min: number | null;
  @ApiProperty({ nullable: true, type: Number }) max: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxLength: number | null;
}

export class SettingsSectionMetadataDto {
  @ApiProperty({
    enum: ['academic', 'invoice-email', 'payments', 'payroll', 'branding', 'modules', 'integrations', 'ai'],
  })
  key: string;
  @ApiProperty() label: string;
  @ApiProperty({ type: [SettingFieldDto] }) fields: SettingFieldDto[];
}

export class SettingsSectionResponseDto {
  @ApiProperty() section: string;
  @ApiProperty() label: string;
  @ApiProperty({ description: 'Valores tipados por clave; los secretos se devuelven enmascarados', type: Object })
  values: Record<string, unknown>;
}
