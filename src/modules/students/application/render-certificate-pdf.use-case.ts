import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import {
  GetCertificateDocumentUseCase,
  type GetCertificateDocumentInput,
} from './get-certificate-document.use-case.js';
import {
  CERTIFICATE_RENDERER,
  type CertificateRendererPort,
  type RenderedCertificate,
} from './ports/certificate-renderer.port.js';

/**
 * Study certificate as a server-generated PDF, with the same access rules
 * as {@link GetCertificateDocumentUseCase} (only valid certificates, admins
 * or the student/guardian owner). Complements the JSON document used by the
 * printable screen.
 */
@Injectable()
export class RenderCertificatePdfUseCase implements UseCase<GetCertificateDocumentInput, RenderedCertificate> {
  constructor(
    private readonly getDocument: GetCertificateDocumentUseCase,
    @Inject(CERTIFICATE_RENDERER) private readonly renderer: CertificateRendererPort,
  ) {}

  async execute(input: GetCertificateDocumentInput): Promise<RenderedCertificate> {
    return this.renderer.render(await this.getDocument.execute(input));
  }
}
