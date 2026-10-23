import { BusinessRuleViolationError, NotFoundError } from '../../../../shared/domain/domain-error.js';
import { CREDIT_NOTE_CONCEPTS, catalogName, DEBIT_NOTE_CONCEPTS } from '../../domain/catalogs.js';
import type { BillingReference, Discrepancy, ElectronicDocument } from '../../domain/electronic-document.js';
import type { ElectronicDocumentRepository } from '../../domain/electronic-document.repository.js';

/**
 * Loads the invoice a credit/debit note corrects. It must be an accepted
 * invoice (or, in habilitation, one already sent to the test set); the legacy
 * picked "the last accepted or sent invoice" instead of the one requested.
 */
export async function loadReferencedInvoice(
  documents: ElectronicDocumentRepository,
  invoiceId: number,
): Promise<ElectronicDocument> {
  const invoice = await documents.findById(invoiceId);
  if (!invoice) throw new NotFoundError('Factura electrónica', invoiceId);
  if (!invoice.isReferenceable) {
    throw new BusinessRuleViolationError(
      `La factura ${invoice.number} no puede corregirse con una nota: debe estar validada por la DIAN.`,
      'INVOICE_NOT_REFERENCEABLE',
    );
  }
  return invoice;
}

export const referenceTo = (invoice: ElectronicDocument): BillingReference => ({
  documentId: invoice.id as number,
  number: invoice.number,
  uniqueCode: invoice.uniqueCode as string,
  issueDate: invoice.issueDate,
});

/** Discrepancy with the catalog description when none is given. */
export function discrepancyFor(type: 'nc' | 'nd', code: string, description?: string | null): Discrepancy {
  const fallback = catalogName(type === 'nc' ? CREDIT_NOTE_CONCEPTS : DEBIT_NOTE_CONCEPTS, code) ?? '';
  return { code, description: description?.trim() || fallback };
}
