import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type ClockPort } from '../../../../shared/application/ports/clock.port.js';
import type { UseCase } from '../../../../shared/application/use-case.js';
import { CalendarDate } from '../../domain/common/calendar-date.js';
import { INSTITUTION_PROFILE, type InstitutionProfilePort } from '../../domain/documents/institution-profile.port.js';
import {
  DOCUMENT_RENDERER,
  type DocumentRendererPort,
  type RenderedDocument,
} from '../ports/document-renderer.port.js';
import { GetIncomeCertificateUseCase, type GetIncomeCertificateInput } from './get-income-certificate.use-case.js';

/**
 * Printable (PDF) income and withholding summary, with the same
 * authorization and computation as {@link GetIncomeCertificateUseCase}.
 */
@Injectable()
export class RenderIncomeCertificateUseCase implements UseCase<GetIncomeCertificateInput, RenderedDocument> {
  constructor(
    private readonly getCertificate: GetIncomeCertificateUseCase,
    @Inject(INSTITUTION_PROFILE) private readonly institution: InstitutionProfilePort,
    @Inject(DOCUMENT_RENDERER) private readonly renderer: DocumentRendererPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  async execute(input: GetIncomeCertificateInput): Promise<RenderedDocument> {
    const [certificate, institution] = await Promise.all([this.getCertificate.execute(input), this.institution.get()]);
    return this.renderer.incomeCertificate({
      institution,
      certificate,
      issuedOn: CalendarDate.fromInstant(this.clock.now()),
    });
  }
}
