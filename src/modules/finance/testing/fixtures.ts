import { Role } from '../../../shared/domain/role.js';
import { Money } from '../../../shared/domain/value-objects/money.vo.js';
import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { BillingConcept, type BillingConceptData } from '../domain/billing-concept.js';
import { BillingPeriod } from '../domain/billing-period.vo.js';
import { ChargeAmounts } from '../domain/charge-amounts.vo.js';
import { StudentCharge } from '../domain/student-charge.js';
import type { BillingStudent } from '../domain/student-directory.port.js';
import { TaxRate } from '../domain/tax-rate.vo.js';

export const actorWith = (role: Role, userId = 1): AuthenticatedActor => ({
  userId,
  role,
  email: `${role}@colegio.edu.co`,
  name: role,
  tenant: 'colegio',
});

export const financeUser = actorWith(Role.FINANCE, 9);

export const aStudent = (overrides: Partial<BillingStudent> = {}): BillingStudent => ({
  id: 1,
  code: 'AL20260001',
  fullName: 'Ana Pérez',
  documentNumber: '1012345678',
  status: 'active',
  gradeId: 1,
  gradeName: 'Primero',
  classroomName: '1A',
  scholarshipPct: 0,
  guardianName: 'Luis Pérez',
  guardianPhone: '3001234567',
  ...overrides,
});

export const aConcept = (overrides: Partial<BillingConceptData> = {}): BillingConcept =>
  BillingConcept.create({ name: 'Pensión', category: 'pension', amount: 350000, taxRate: 0, ...overrides });

export const aCharge = (
  overrides: Partial<{ studentId: number; conceptId: number; net: number; dueDate: string; taxRate: number }> = {},
): StudentCharge => {
  const dueDate = overrides.dueDate ?? '2026-02-28';
  return StudentCharge.create({
    studentId: overrides.studentId ?? 1,
    conceptId: overrides.conceptId ?? 1,
    description: 'Pensión — Febrero 2026',
    amounts: ChargeAmounts.compute(Money.of(overrides.net ?? 350000), TaxRate.of(overrides.taxRate ?? 0)),
    period: BillingPeriod.fromDate(dueDate),
    dueDate,
    academicYear: 2026,
    createdBy: 9,
  });
};
