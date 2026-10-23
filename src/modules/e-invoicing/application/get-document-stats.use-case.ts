import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { Amounts } from '../domain/amounts.js';
import type { DocumentCounts } from '../domain/electronic-document.repository.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';

export interface DocumentStatsView {
  counts: DocumentCounts;
  acceptedInvoicesTotal: number;
}

/** KPIs of the e-invoicing dashboard: documents per type/status and total invoiced (accepted). */
@Injectable()
export class GetDocumentStatsUseCase implements UseCase<{ from?: string; to?: string }, DocumentStatsView> {
  constructor(@Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository) {}

  async execute(range: { from?: string; to?: string }): Promise<DocumentStatsView> {
    const stats = await this.documents.stats(range);
    return { counts: stats.counts, acceptedInvoicesTotal: Amounts.toNumber(stats.acceptedInvoicesTotalCents) };
  }
}
