import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { DocumentLine } from '../domain/document-line.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import type { PaymentVoidedPayload } from './integration-events.js';
import type { AutomaticDocumentResult } from './invoice-registered-payment.use-case.js';
import { BACKGROUND_EXECUTOR, type BackgroundExecutorPort } from './ports/background-executor.port.js';
import { DocumentIssuer } from './services/document-issuer.js';
import { DocumentSubmitter } from './services/document-submitter.js';
import { discrepancyFor, referenceTo } from './services/referenced-invoice.js';

/**
 * Reaction to `finance.payment-voided`: when automatic invoicing is enabled and
 * the payment's invoice is validated by the DIAN, issues a credit note that
 * annuls it in full (concept 2) and sends it in background. Invoices not yet
 * validated, or already (partially) credited, are left for manual handling.
 */
@Injectable()
export class CreditVoidedPaymentUseCase implements UseCase<PaymentVoidedPayload, AutomaticDocumentResult> {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(BACKGROUND_EXECUTOR) private readonly background: BackgroundExecutorPort,
    private readonly issuer: DocumentIssuer,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(voided: PaymentVoidedPayload): Promise<AutomaticDocumentResult> {
    if (!(await this.configs.get()).autoInvoiceOnPayment)
      return { status: 'skipped', reason: 'AUTO_INVOICING_DISABLED' };
    const [invoice] = await this.documents.findBySourcePayment(voided.paymentId, 'fv');
    if (!invoice) return { status: 'skipped', reason: 'NOT_INVOICED' };
    if (!invoice.isAccepted) return { status: 'skipped', reason: 'INVOICE_NOT_ACCEPTED' };
    if ((await this.documents.creditedTotalCents(invoice.id as number)) > 0) {
      return { status: 'skipped', reason: 'ALREADY_CREDITED' };
    }

    const document = await this.issuer.issue({
      type: 'nc',
      customer: invoice.customer,
      lines: invoice.lines.map((line) => DocumentLine.restore(line.toProps())),
      paymentMeans: { ...invoice.paymentMeans },
      notes: `Anulación del recibo ${voided.receiptNumber}: ${voided.reason}`.slice(0, 2000),
      billingReference: referenceTo(invoice),
      discrepancy: discrepancyFor('nc', '2'),
      sourcePaymentId: voided.paymentId,
    });
    this.background.run(`dian-submit-${document.number}`, () => this.submitter.submit(document));
    return { status: 'issued', documentId: document.id as number, number: document.number };
  }
}
