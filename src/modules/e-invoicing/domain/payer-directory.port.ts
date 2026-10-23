/** Data of the person who pays a student's charges, mapped to DIAN codes. */
export interface PayerData {
  name: string;
  /** Given names / surnames for natural persons (`cac:Person`). */
  firstName: string | null;
  familyName: string | null;
  /** DIAN identification type code (13 CC, 12 TI, 22 CE, 41 passport, 11 civil registry, 31 NIT). */
  idType: string;
  idNumber: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

/**
 * Read-only access to students/guardians (students context) to identify the
 * acquirer of an automatic invoice. The guardian is preferred; the student is
 * the fallback.
 */
export interface PayerDirectoryPort {
  findPayerOfStudent(studentId: number): Promise<PayerData | null>;
}

export const PAYER_DIRECTORY = Symbol('PayerDirectoryPort');
