import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import type { DocumentStatus } from '../domain/electronic-document.js';
import {
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { DocumentSubmitter } from './services/document-submitter.js';

/** Maximum automatic attempts per document; beyond it only a manual submission retries. */
export const MAX_AUTOMATIC_ATTEMPTS = 10;
const BATCH_SIZE = 25;

export interface RetrySummary {
  processed: number;
  skipped: number;
  results: { id: number; number: string; status: DocumentStatus }[];
}

/**
 * Sends the documents left unsent (`signed`, e.g. after a restart while the
 * automatic submission was pending) or failed in transport (`send_error`),
 * oldest first, with the same signed XML (idempotent: CUFE unchanged).
 */
@Injectable()
export class RetryPendingSubmissionsUseCase implements UseCase<void, RetrySummary> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    private readonly submitter: DocumentSubmitter,
  ) {}

  async execute(): Promise<RetrySummary> {
    const pending = await this.documents.findPendingSubmission(BATCH_SIZE);
    const eligible = pending.filter((document) => document.attempts < MAX_AUTOMATIC_ATTEMPTS);
    const results: RetrySummary['results'] = [];
    for (const document of eligible) {
      const sent = await this.submitter.submit(document);
      results.push({ id: sent.id as number, number: sent.number, status: sent.status });
    }
    return { processed: results.length, skipped: pending.length - eligible.length, results };
  }
}
