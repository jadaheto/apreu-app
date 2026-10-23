import { ApiProperty } from '@nestjs/swagger';

export class LevelCountDto {
  @ApiProperty({ example: 'primaria' }) level: string;
  @ApiProperty() total: number;
}

export class StudentWidgetsDto {
  @ApiProperty() active: number;
  @ApiProperty() total: number;
  @ApiProperty({ type: [LevelCountDto] }) byLevel: LevelCountDto[];
}

export class AmountCountDto {
  @ApiProperty() amount: number;
  @ApiProperty() payments: number;
}

export class OverdueDto {
  @ApiProperty() amount: number;
  @ApiProperty() debtors: number;
}

export class AverageTicketDto {
  @ApiProperty() amount: number;
  @ApiProperty({ example: '2026-10' }) month: string;
}

export class MonthlyRevenuePointDto {
  @ApiProperty({ example: '2026-10' }) month: string;
  @ApiProperty({ example: 'oct' }) label: string;
  @ApiProperty() amount: number;
}

export class RecentPaymentDto {
  @ApiProperty() paymentId: number;
  @ApiProperty({ nullable: true, type: String }) receiptNumber: string | null;
  @ApiProperty() amount: number;
  @ApiProperty({ nullable: true, type: String, example: 'efectivo' }) method: string | null;
  @ApiProperty({ nullable: true, type: String, example: '2026-10-16 09:30:00' }) paidAt: string | null;
  @ApiProperty() studentId: number;
  @ApiProperty() studentName: string;
  @ApiProperty() studentCode: string;
}

export class DebtorDto {
  @ApiProperty() studentId: number;
  @ApiProperty() studentName: string;
  @ApiProperty() studentCode: string;
  @ApiProperty({ nullable: true, type: String }) gradeName: string | null;
  @ApiProperty() balance: number;
  @ApiProperty({ example: '2026-07-05' }) oldestDueDate: string;
  @ApiProperty() daysOverdue: number;
  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] }) risk: string;
}

export class FinanceWidgetsDto {
  @ApiProperty({ type: AmountCountDto }) todayRevenue: AmountCountDto;
  @ApiProperty({ type: OverdueDto }) overdue: OverdueDto;
  @ApiProperty({ type: AverageTicketDto }) averageTicket: AverageTicketDto;
  @ApiProperty({ type: [MonthlyRevenuePointDto] }) monthlyRevenue: MonthlyRevenuePointDto[];
  @ApiProperty({ type: [RecentPaymentDto] }) recentPayments: RecentPaymentDto[];
  @ApiProperty({ type: [DebtorDto] }) topDebtors: DebtorDto[];
}

export class StaffWidgetsDto {
  @ApiProperty() activeEmployees: number;
}

export class IncidentWidgetsDto {
  @ApiProperty() pending: number;
}

export class AdminDashboardResponseDto {
  @ApiProperty({ example: '2026-10-16' }) today: string;
  @ApiProperty({ example: 2026 }) academicYear: number;
  @ApiProperty({ type: StudentWidgetsDto }) students: StudentWidgetsDto;
  @ApiProperty({ type: FinanceWidgetsDto, nullable: true, description: 'Solo superadmin, admin y finanzas' })
  finance: FinanceWidgetsDto | null;
  @ApiProperty({ type: StaffWidgetsDto, nullable: true, description: 'Solo superadmin, admin y RRHH' })
  staff: StaffWidgetsDto | null;
  @ApiProperty({ type: IncidentWidgetsDto, nullable: true, description: 'Solo superadmin, admin y RRHH' })
  incidents: IncidentWidgetsDto | null;
}
