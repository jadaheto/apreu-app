import type { ReportCardDocument } from '../report-card-document.js';

/** Renders a report card as a printable PDF (letter size). */
export interface ReportCardRendererPort {
  render(document: ReportCardDocument): Promise<Uint8Array>;
}

export const REPORT_CARD_RENDERER = Symbol('ReportCardRendererPort');
