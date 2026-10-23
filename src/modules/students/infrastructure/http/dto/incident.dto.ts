import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import {
  INCIDENT_PRIORITIES,
  INCIDENT_STATUSES,
  INCIDENT_TYPES,
  PORTAL_INCIDENT_TYPES,
  REVIEW_ACTIONS,
  type IncidentPriority,
  type IncidentStatus,
  type IncidentType,
  type ReviewAction,
} from '../../../domain/incident.js';

export class CreateIncidentDto {
  @ApiPropertyOptional({ enum: INCIDENT_TYPES, default: 'otra' })
  @IsOptional()
  @IsIn(INCIDENT_TYPES)
  type?: IncidentType;

  @ApiPropertyOptional({ enum: INCIDENT_PRIORITIES, default: 'medium' })
  @IsOptional()
  @IsIn(INCIDENT_PRIORITIES)
  priority?: IncidentPriority;

  @ApiProperty({ example: 'Solicitud de baja' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Alumno relacionado' })
  @IsOptional()
  @IsInt()
  @Min(1)
  studentId?: number;
}

export class ReportIncidentDto {
  @ApiPropertyOptional({ enum: PORTAL_INCIDENT_TYPES, default: 'otra' })
  @IsOptional()
  @IsIn(PORTAL_INCIDENT_TYPES)
  type?: IncidentType;

  @ApiProperty({ example: 'Incapacidad médica' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}

export class ReviewIncidentDto {
  @ApiProperty({ enum: REVIEW_ACTIONS })
  @IsIn(REVIEW_ACTIONS)
  action: ReviewAction;

  @ApiPropertyOptional({ example: 'Se verificó la incapacidad.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}

export class ListIncidentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: INCIDENT_STATUSES })
  @IsOptional()
  @IsIn(INCIDENT_STATUSES)
  status?: IncidentStatus;

  @ApiPropertyOptional({ enum: INCIDENT_TYPES })
  @IsOptional()
  @IsIn(INCIDENT_TYPES)
  type?: IncidentType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  studentId?: number;
}
