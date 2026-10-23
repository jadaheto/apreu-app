import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { BillingConcept } from '../../domain/billing-concept.js';
import { BillingPeriod } from '../../domain/billing-period.vo.js';
import { ChargeAmounts } from '../../domain/charge-amounts.vo.js';
import { Expense } from '../../domain/expense.js';
import { ExpenseCategory } from '../../domain/expense-category.js';
import { Payment, type PaymentApplication } from '../../domain/payment.js';
import { StudentCharge } from '../../domain/student-charge.js';
import { TaxRate } from '../../domain/tax-rate.vo.js';
import { BillingConceptOrmEntity } from './billing-concept.orm-entity.js';
import { ExpenseCategoryOrmEntity } from './expense-category.orm-entity.js';
import { ExpenseOrmEntity } from './expense.orm-entity.js';
import type { PaymentApplicationOrmEntity } from './payment-application.orm-entity.js';
import { PaymentOrmEntity } from './payment.orm-entity.js';
import { StudentChargeOrmEntity } from './student-charge.orm-entity.js';

const money = (value: string | number | null | undefined): Money => Money.of(value ?? 0);

/** Translates `billing_concepts` rows. */
export const BillingConceptMapper = {
  toDomain(row: BillingConceptOrmEntity): BillingConcept {
    return BillingConcept.restore(row.id, {
      name: row.name,
      description: row.description,
      code: row.code,
      category: row.category ?? 'pension',
      amount: money(row.amount),
      taxRate: TaxRate.of(row.taxRate),
      isActive: row.isActive,
      createdAt: row.createdAt,
    });
  },

  toPersistence(concept: BillingConcept): BillingConceptOrmEntity {
    const row = new BillingConceptOrmEntity();
    if (concept.id !== null) row.id = concept.id;
    row.name = concept.name;
    row.description = concept.description;
    row.code = concept.code;
    row.category = concept.category;
    row.amount = concept.amount.amount.toFixed(2);
    row.taxRate = concept.taxRate.percent.toFixed(2);
    row.isActive = concept.isActive;
    return row;
  },
};

/** Translates `student_charges` rows; the paid amount comes from `payment_applications`. */
export const StudentChargeMapper = {
  toDomain(row: StudentChargeOrmEntity, paid: Money): StudentCharge {
    return StudentCharge.restore(row.id, {
      studentId: row.studentId,
      conceptId: row.conceptId,
      description: row.description,
      amounts: ChargeAmounts.restore({
        base: money(row.amount),
        taxRate: TaxRate.of(row.taxRate),
        discount: money(row.discountAmount),
        tax: money(row.taxAmount),
        net: money(row.netAmount),
      }),
      period: BillingPeriod.create(row.billingPeriod ?? row.dueDate.slice(0, 7)),
      dueDate: row.dueDate,
      status: row.status ?? 'pending',
      academicYear: Number(row.academicYear),
      createdBy: row.createdBy,
      paidAmount: paid,
      createdAt: row.createdAt,
    });
  },

  toPersistence(charge: StudentCharge): StudentChargeOrmEntity {
    const row = new StudentChargeOrmEntity();
    if (charge.id !== null) row.id = charge.id;
    row.studentId = charge.studentId;
    row.conceptId = charge.conceptId;
    row.description = charge.description;
    row.amount = charge.amounts.base.amount.toFixed(2);
    row.taxRate = charge.amounts.taxRate.percent.toFixed(2);
    row.taxAmount = charge.amounts.tax.amount.toFixed(2);
    row.discountAmount = charge.amounts.discount.amount.toFixed(2);
    row.netAmount = charge.amounts.net.amount.toFixed(2);
    row.dueDate = charge.dueDate;
    row.billingPeriod = charge.period.toString();
    row.status = charge.status;
    row.academicYear = charge.academicYear;
    row.createdBy = charge.createdBy;
    return row;
  },
};

/** Translates `payments` rows plus their `payment_applications`. */
export const PaymentMapper = {
  toDomain(row: PaymentOrmEntity, applications: PaymentApplicationOrmEntity[]): Payment {
    return Payment.restore(row.id, {
      studentId: row.studentId,
      receiptNumber: row.receiptNo ?? `#${row.id}`,
      amount: money(row.amount),
      method: row.paymentMethod ?? 'efectivo',
      paidAt: row.paymentDate ?? row.createdAt ?? new Date(0),
      cashierId: row.cashierId,
      notes: row.notes,
      reference: row.reference,
      status: row.status ?? 'applied',
      applications: applications.map((application): PaymentApplication => ({
        id: application.id,
        chargeId: application.chargeId,
        amount: money(application.amountApplied),
      })),
      reconciliation: row.reconciled
        ? {
            bankRef: row.bankRef ?? '',
            reconciledAt: row.reconciledAt ?? row.createdAt ?? new Date(0),
            reconciledBy: row.reconciledBy,
          }
        : null,
      voiding: row.voidedAt ? { reason: row.voidReason ?? '', voidedAt: row.voidedAt, voidedBy: row.voidedBy } : null,
      createdAt: row.createdAt,
    });
  },

  toPersistence(payment: Payment): PaymentOrmEntity {
    const row = new PaymentOrmEntity();
    if (payment.id !== null) row.id = payment.id;
    row.studentId = payment.studentId;
    row.receiptNo = payment.receiptNumber;
    row.amount = payment.amount.amount.toFixed(2);
    row.paymentMethod = payment.method;
    row.paymentDate = payment.paidAt;
    row.cashierId = payment.cashierId;
    row.notes = payment.notes;
    row.reference = payment.reference;
    row.status = payment.status;
    row.reconciled = payment.reconciliation !== null;
    row.bankRef = payment.reconciliation?.bankRef ?? null;
    row.reconciledAt = payment.reconciliation?.reconciledAt ?? null;
    row.reconciledBy = payment.reconciliation?.reconciledBy ?? null;
    row.voidedAt = payment.voiding?.voidedAt ?? null;
    row.voidedBy = payment.voiding?.voidedBy ?? null;
    row.voidReason = payment.voiding?.reason ?? null;
    return row;
  },
};

/** Translates `expenses` and `expense_categories` rows. */
export const ExpenseMapper = {
  toDomain(row: ExpenseOrmEntity): Expense {
    return Expense.restore(row.id, {
      categoryId: row.categoryId,
      description: row.description,
      amount: money(row.amount),
      date: row.expenseDate,
      vendor: row.vendor,
      receiptNo: row.receiptNo,
      paymentMethod: row.paymentMethod ?? 'efectivo',
      notes: row.notes,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  },

  toPersistence(expense: Expense): ExpenseOrmEntity {
    const row = new ExpenseOrmEntity();
    if (expense.id !== null) row.id = expense.id;
    row.categoryId = expense.categoryId;
    row.description = expense.description;
    row.amount = expense.amount.amount.toFixed(2);
    row.expenseDate = expense.date;
    row.vendor = expense.vendor;
    row.receiptNo = expense.receiptNo;
    row.paymentMethod = expense.paymentMethod;
    row.notes = expense.notes;
    row.createdBy = expense.createdBy;
    return row;
  },

  categoryToDomain(row: ExpenseCategoryOrmEntity): ExpenseCategory {
    return ExpenseCategory.restore(row.id, { name: row.name, createdAt: row.createdAt });
  },

  categoryToPersistence(category: ExpenseCategory): ExpenseCategoryOrmEntity {
    const row = new ExpenseCategoryOrmEntity();
    if (category.id !== null) row.id = category.id;
    row.name = category.name;
    return row;
  },
};
