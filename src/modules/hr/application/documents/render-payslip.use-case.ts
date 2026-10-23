import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../../shared/application/use-case.js';
import {
  DOCUMENT_RENDERER,
  type DocumentRendererPort,
  type RenderedDocument,
} from '../ports/document-renderer.port.js';
import { GetPayslipUseCase, type GetPayslipInput } from './get-payslip.use-case.js';

/** Printable payslip with the same authorization rules as {@link GetPayslipUseCase}. */
@Injectable()
export class RenderPayslipUseCase implements UseCase<GetPayslipInput, RenderedDocument> {
  constructor(
    private readonly getPayslip: GetPayslipUseCase,
    @Inject(DOCUMENT_RENDERER) private readonly renderer: DocumentRendererPort,
  ) {}

  async execute(input: GetPayslipInput): Promise<RenderedDocument> {
    return this.renderer.payslip(await this.getPayslip.execute(input));
  }
}
