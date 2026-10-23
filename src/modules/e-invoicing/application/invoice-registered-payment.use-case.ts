import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Amounts } from '../domain/amounts.js';
import { CHARGE_TAX, type ChargeTaxPort } from '../domain/charge-tax.port.js';
import { DocumentLine } from '../domain/document-line.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import type { IssuerConfig } from '../domain/issuer-config.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import { FINAL_CONSUMER, Party } from '../domain/party.js';
import { PAYER_DIRECTORY, type PayerDirectoryPort } from '../domain/payer-directory.port.js';
import type { PaymentRegisteredPayload } from './integration-events.js';
import { BACKGROUND_EXECUTOR, type BackgroundExecutorPort } from './ports/background-executor.port.js';
import { DocumentIssuer } from './services/document-issuer.js';
import { DocumentSubmitter } from './services/document-submitter.js';

export type AutomaticDocumentResult =
  { status: 'issued'; documentId: number; number: string } | { status: 'skipped'; reason: string };

/** Finance payment methods (`payments.payment_method`) → DIAN payment means code. */
export const PAYMENT_MEANS_BY_METHOD: Readonly<Record<string, string>> = {
  efectivo: '10',
  cheque: '20',
  transferencia: '47',
  transferencia_ext: '47',
  nequi: '47',
  daviplata: '47',
  breb: '47',
  pse: '47',
  tarjeta: '48',
  datafono: '49',
};

/**
 * Reaction to `finance.payment-registered`: when automatic invoicing is
 * enabled, issues one cash invoice per payment (idempotent per payment) with a
 * line per applied charge and sends it to the DIAN in background.
 *
 * - Acquirer: the student's guardian (or the student); "consumidor final" if unknown.
 * - VAT: charges with rate 0 are excluded (educational services); for taxed
 *   charges the paid amount is VAT-inclusive and the base is derived from it.
 * - Payment means from the finance method (fixes the legacy "20 = crédito").
 */
@Injectable()
export class InvoiceRegisteredPaymentUseCase implements UseCase<PaymentRegisteredPayload, AutomaticDocumentResult> {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(PAYER_DIRECTORY) private readonly payers: PayerDirectoryPort,
    @Inject(CHARGE_TAX) private readonly chargeTaxes: ChargeTaxPort,
    @Inject(BACKGROUND_EXECUTOR) private readonly background: BackgroundExecutorPort,
    private readonly issuer: DocumentIssuer,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(payment: PaymentRegisteredPayload): Promise<AutomaticDocumentResult> {
    const config = await this.configs.get();
    if (!config.autoInvoiceOnPayment) return { status: 'skipped', reason: 'AUTO_INVOICING_DISABLED' };
    if ((await this.documents.findBySourcePayment(payment.paymentId, 'fv')).length) {
      return { status: 'skipped', reason: 'ALREADY_INVOICED' };
    }

    const document = await this.issuer.issue({
      type: 'fv',
      customer: await this.customerOf(payment.studentId, config),
      lines: await this.linesOf(payment),
      paymentMeans: { form: '1', code: PAYMENT_MEANS_BY_METHOD[payment.method] ?? '1', dueDate: null },
      notes: `Recibo de caja ${payment.receiptNumber}`,
      sourcePaymentId: payment.paymentId,
    });
    this.background.run(`dian-submit-${document.number}`, () => this.submitter.submit(document));
    return { status: 'issued', documentId: document.id as number, number: document.number };
  }

  private async customerOf(studentId: number, config: IssuerConfig): Promise<Party> {
    const payer = await this.payers.findPayerOfStudent(studentId);
    const base = { location: config.location, taxLevelCode: 'R-99-PN', vatRegime: '49' as const };
    if (!payer) return Party.create({ ...FINAL_CONSUMER, email: null, phone: null, address: null, ...base });
    return Party.create({ ...payer, ...base });
  }

  private async linesOf(payment: PaymentRegisteredPayload): Promise<DocumentLine[]> {
    if (payment.appliedCharges.length === 0) {
      return [
        DocumentLine.create({
          description: `Pago recibo ${payment.receiptNumber}`,
          quantity: 1,
          unitPrice: payment.totalAmount,
        }),
      ];
    }
    const rates = await this.chargeTaxes.taxRatesOf(payment.appliedCharges.map((charge) => charge.studentChargeId));
    return payment.appliedCharges.map((charge) => {
      const rate = rates.get(charge.studentChargeId) ?? 0;
      const common = { description: charge.conceptName, code: String(charge.conceptId), quantity: 1 };
      if (rate <= 0) return DocumentLine.create({ ...common, unitPrice: charge.amount });
      const rateBasisPoints = Amounts.toScaled(rate, 2, 'tarifa de IVA');
      const grossCents = Amounts.toScaled(charge.amount, 2, 'valor aplicado');
      const baseCents = Amounts.divideHalfUp(grossCents * 10_000, 10_000 + rateBasisPoints);
      return DocumentLine.create({
        ...common,
        unitPrice: Amounts.format(baseCents),
        taxTreatment: 'taxed',
        taxRate: rate,
      });
    });
  }
}
