import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { PaymentForm } from '../domain/catalogs.js';
import type { DocumentLineInput } from '../domain/document-line.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';
import { toDocumentDetailView, type DocumentDetailView } from './document-view.js';
import { type CustomerInput, toCustomerParty, toLines } from './services/document-inputs.js';
import { DocumentIssuer } from './services/document-issuer.js';
import { DocumentSubmitter } from './services/document-submitter.js';

export interface IssueInvoiceInput {
  customer: CustomerInput;
  lines: DocumentLineInput[];
  paymentMeans: { form: PaymentForm; code: string; dueDate?: string | null };
  notes?: string | null;
}

/**
 * Issues a sales invoice (FV) manually and sends it to the DIAN
 * (legacy `api/dian/generate_invoice.php` with `invoice_type=fv`).
 */
@Injectable()
export class IssueInvoiceUseCase implements UseCase<IssueInvoiceInput, DocumentDetailView> {
  constructor(
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
    private readonly issuer: DocumentIssuer,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(input: IssueInvoiceInput): Promise<DocumentDetailView> {
    const config = await this.configs.get();
    const document = await this.issuer.issue({
      type: 'fv',
      customer: toCustomerParty(input.customer, config),
      lines: toLines(input.lines),
      paymentMeans: { ...input.paymentMeans, dueDate: input.paymentMeans.dueDate ?? null },
      notes: input.notes,
    });
    return toDocumentDetailView(await this.submitter.submit(document));
  }
}
