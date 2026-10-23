import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { LEAVE_STATUSES, LEAVE_TYPES, type LeaveStatus, type LeaveType } from '../../../domain/leaves/leave-request.js';

export class RequestLeaveDto {
  @ApiProperty({ enum: LEAVE_TYPES }) @IsIn(LEAVE_TYPES) leaveType: LeaveType;
  @ApiProperty({ example: '2026-04-06' }) @IsISO8601({ strict: true }) startDate: string;
  @ApiProperty({ example: '2026-04-10' }) @IsISO8601({ strict: true }) endDate: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) reason: string;
}

/** HR registers a request on behalf of an employee. */
export class HrRequestLeaveDto extends RequestLeaveDto {
  @ApiProperty() @IsInt() @Min(1) employeeId: number;
}

export class ApproveLeaveDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) note?: string;
}

export class RejectLeaveDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) reason: string;
}

export class ListLeavesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LEAVE_STATUSES }) @IsOptional() @IsIn(LEAVE_STATUSES) status?: LeaveStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) employeeId?: number;
  @ApiPropertyOptional({ example: '2026-01-01' }) @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @ApiPropertyOptional({ example: '2026-12-31' }) @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
