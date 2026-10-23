import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  type DocumentCounts,
  ELECTRONIC_DOCUMENT_REPOSITORY,
  type ElectronicDocumentRepository,
} from '../domain/electronic-document.repository.js';
import { ISSUER_CONFIG_REPOSITORY, type IssuerConfigRepository } from '../domain/issuer-config.repository.js';

export interface TestSetProgressView {
  testSetId: string | null;
  environment: string;
  /** Documents sent to the test set by type and status (pending documents are not counted as accepted). */
  counts: DocumentCounts;
}

/** Progress of the habilitation test set (legacy counted `pending` documents as done). */
@Injectable()
export class GetTestSetProgressUseCase implements UseCase<void, TestSetProgressView> {
  constructor(
    @Inject(ELECTRONIC_DOCUMENT_REPOSITORY) private readonly documents: ElectronicDocumentRepository,
    @Inject(ISSUER_CONFIG_REPOSITORY) private readonly configs: IssuerConfigRepository,
  ) {}

  async execute(): Promise<TestSetProgressView> {
    const config = await this.configs.get();
    return {
      testSetId: config.testSetId,
      environment: config.environment,
      counts: await this.documents.testSetCounts(),
    };
  }
}
