import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { NotFoundError } from '../../../../shared/domain/domain-error.js';
import {
  ISSUED_DOCUMENT_REPOSITORY,
  type IssuedDocumentRepository,
  type IssuedDocumentType,
  normalizeVerificationCode,
} from '../../domain/documents/issued-document.js';

/** Public answer of the verification: enough to confirm authenticity, no salary data. */
export interface DocumentVerificationView {
  code: string;
  type: IssuedDocumentType;
  employeeName: string;
  issuedAt: Date;
  institutionName: string;
}

/** Public verification of an issued certificate by its code (analysis §6.4 `VerifyIssuedDocument`). */
@Injectable()
export class VerifyIssuedDocumentUseCase implements UseCase<string, DocumentVerificationView> {
  constructor(@Inject(ISSUED_DOCUMENT_REPOSITORY) private readonly documents: IssuedDocumentRepository) {}

  async execute(code: string): Promise<DocumentVerificationView> {
    const document = await this.documents.findByCode(normalizeVerificationCode(code));
    if (!document) throw new NotFoundError('Documento', code);
    const content = document.content as { employeeName?: string; institution?: { name?: string } };
    return {
      code: document.code,
      type: document.type,
      employeeName: content.employeeName ?? '',
      issuedAt: document.issuedAt,
      institutionName: content.institution?.name ?? '',
    };
  }
}
