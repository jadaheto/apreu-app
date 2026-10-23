import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import type { DownloadableFile } from './downloadable-file.js';
import { safeFileName } from './file-names.js';
import { GetReportCardUseCase, type GetReportCardInput } from './get-report-card.use-case.js';
import { REPORT_CARD_RENDERER, type ReportCardRendererPort } from './ports/report-card-renderer.port.js';

/** The report card as a PDF, with the same access rules and view counting as {@link GetReportCardUseCase}. */
@Injectable()
export class DownloadReportCardPdfUseCase implements UseCase<GetReportCardInput, DownloadableFile> {
  constructor(
    private readonly getReportCard: GetReportCardUseCase,
    @Inject(REPORT_CARD_RENDERER) private readonly renderer: ReportCardRendererPort,
  ) {}

  async execute(input: GetReportCardInput): Promise<DownloadableFile> {
    const document = await this.getReportCard.execute(input);
    return {
      fileName: `boletin-${safeFileName(document.student.code)}-${safeFileName(document.period.name)}.pdf`,
      contentType: 'application/pdf',
      content: await this.renderer.render(document),
    };
  }
}
