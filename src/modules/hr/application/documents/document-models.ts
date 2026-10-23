import type { InstitutionProfile } from '../../domain/documents/institution-profile.port.js';
import type { IncomeCertificateView } from './get-income-certificate.use-case.js';

/** A labelled amount printed on a payslip. */
export interface PayslipLine {
  label: string;
  amount: number;
}

/**
 * Everything needed to render a payslip (legacy `hr/print_payslip.php`,
 * `hr/portal.php?section=payslip`, `employee/mi_nomina.php` unified, D-4).
 * Lines always add up to the totals (fixes B-19/B-20).
 */
export interface PayslipDocument {
  institution: InstitutionProfile;
  paymentId: number;
  status: string;
  period: { id: number; name: string; label: string; startDate: string; endDate: string; paymentDate: string };
  employee: {
    fullName: string;
    code: string;
    document: string;
    position: string | null;
    department: string | null;
    contract: string;
    bank: { name: string | null; type: string; maskedAccount: string | null };
  };
  workedDays: number;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossTotal: number;
  deductionsTotal: number;
  net: number;
  netInWords: string;
  /** Informative employer contributions (not deducted from the employee). */
  employerContributions: PayslipLine[];
}

/** Frozen content of an employment certificate (legacy `print_cert.php` / `certificado_laboral.php`, D-3). */
export interface EmploymentCertificateContent {
  institution: InstitutionProfile;
  employeeName: string;
  documentLabel: string;
  documentNumber: string;
  position: string | null;
  department: string | null;
  contractLabel: string;
  hireDate: string | null;
  retirementDate: string | null;
  currentlyEmployed: boolean;
  salary: number | null;
  salaryInWords: string | null;
  addressee: string | null;
  issuedOn: string;
  verificationCode: string;
}

export interface IssuedCertificateView {
  verificationCode: string;
  issuedAt: Date;
  content: EmploymentCertificateContent;
}

/** Printable income and withholding summary of a taxable year (legacy `hr/certificado_ingresos.php`). */
export interface IncomeCertificateDocument {
  institution: InstitutionProfile;
  certificate: IncomeCertificateView;
  issuedOn: string;
}
