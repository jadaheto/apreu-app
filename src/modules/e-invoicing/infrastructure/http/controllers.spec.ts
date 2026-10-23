import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { CheckDocumentStatusUseCase } from '../../application/check-document-status.use-case.js';
import { GetCatalogUseCase } from '../../application/get-catalog.use-case.js';
import { GetCertificateInfoUseCase } from '../../application/get-certificate-info.use-case.js';
import { GetDiagnosticsUseCase } from '../../application/get-diagnostics.use-case.js';
import { GetDocumentArtifactUseCase } from '../../application/get-document-artifact.use-case.js';
import { GetDocumentStatsUseCase } from '../../application/get-document-stats.use-case.js';
import { GetDocumentUseCase } from '../../application/get-document.use-case.js';
import { GetIssuerConfigUseCase } from '../../application/get-issuer-config.use-case.js';
import { GetTestSetProgressUseCase } from '../../application/get-test-set-progress.use-case.js';
import { IssueCreditNoteUseCase } from '../../application/issue-credit-note.use-case.js';
import { IssueDebitNoteUseCase } from '../../application/issue-debit-note.use-case.js';
import { IssueInvoiceUseCase } from '../../application/issue-invoice.use-case.js';
import { ListDocumentsUseCase } from '../../application/list-documents.use-case.js';
import { ListResolutionsUseCase } from '../../application/list-resolutions.use-case.js';
import { RegisterResolutionUseCase } from '../../application/register-resolution.use-case.js';
import { ResetHabilitationNumberingUseCase } from '../../application/reset-habilitation-numbering.use-case.js';
import { RetryPendingSubmissionsUseCase } from '../../application/retry-pending-submissions.use-case.js';
import { RunHabilitationTestSetUseCase } from '../../application/run-habilitation-test-set.use-case.js';
import { SubmitDocumentUseCase } from '../../application/submit-document.use-case.js';
import { UpdateIssuerConfigUseCase } from '../../application/update-issuer-config.use-case.js';
import { UpdateResolutionUseCase } from '../../application/update-resolution.use-case.js';
import { CatalogsController } from './catalogs.controller.js';
import { DocumentsController } from './documents.controller.js';
import { ListDocumentsQueryDto } from './dto/documents.dto.js';
import { HabilitationController } from './habilitation.controller.js';
import { IssuerConfigController } from './issuer-config.controller.js';
import { ResolutionsController } from './resolutions.controller.js';

const mockUseCase = (result: unknown = { ok: true }) => ({ execute: vi.fn().mockResolvedValue(result) });
const roles = (target: object, method?: string): Role[] =>
  Reflect.getMetadata(ROLES_KEY, method ? (target as Record<string, object>)[method] : target);

async function build<T>(controller: new (...args: never[]) => T, useCases: [unknown, object][]): Promise<T> {
  const moduleRef = await Test.createTestingModule({
    controllers: [controller],
    providers: useCases.map(([provide, useValue]) => ({ provide: provide as never, useValue })),
  }).compile();
  return moduleRef.get(controller);
}

describe('IssuerConfigController', () => {
  const get = mockUseCase();
  const update = mockUseCase();
  const certificate = mockUseCase();
  const diagnostics = mockUseCase();
  let controller: IssuerConfigController;
  beforeEach(async () => {
    controller = await build(IssuerConfigController, [
      [GetIssuerConfigUseCase, get],
      [UpdateIssuerConfigUseCase, update],
      [GetCertificateInfoUseCase, certificate],
      [GetDiagnosticsUseCase, diagnostics],
    ]);
  });

  it('delegates to the use cases', async () => {
    await controller.show();
    await controller.update({ businessName: 'X' });
    await controller.certificate();
    await controller.diagnose();
    expect(update.execute).toHaveBeenCalledWith({ businessName: 'X' });
    expect([get, certificate, diagnostics].every((u) => u.execute.mock.calls.length === 1)).toBe(true);
  });

  it('restricts writes and sensitive reads to admin', () => {
    expect(roles(IssuerConfigController)).toEqual([Role.ADMIN, Role.FINANCE]);
    for (const method of ['update', 'certificate', 'diagnose'])
      expect(roles(IssuerConfigController.prototype, method)).toEqual([Role.ADMIN]);
  });
});

describe('ResolutionsController', () => {
  const list = mockUseCase([]);
  const register = mockUseCase();
  const update = mockUseCase();
  it('lists, registers and updates (admin only for writes)', async () => {
    const controller = await build(ResolutionsController, [
      [ListResolutionsUseCase, list],
      [RegisterResolutionUseCase, register],
      [UpdateResolutionUseCase, update],
    ]);
    await controller.list();
    const dto = { docType: 'nc' as const, prefix: 'NC', rangeFrom: 1, rangeTo: 10, environment: '2' as const };
    await controller.register(dto);
    await controller.update(4, { active: true });
    expect(register.execute).toHaveBeenCalledWith(dto);
    expect(update.execute).toHaveBeenCalledWith({ id: 4, active: true });
    expect(roles(ResolutionsController.prototype, 'register')).toEqual([Role.ADMIN]);
    expect(roles(ResolutionsController.prototype, 'update')).toEqual([Role.ADMIN]);
  });
});

describe('DocumentsController', () => {
  const useCases = {
    list: mockUseCase(),
    stats: mockUseCase(),
    get: mockUseCase(),
    invoice: mockUseCase(),
    credit: mockUseCase(),
    debit: mockUseCase(),
    submit: mockUseCase(),
    status: mockUseCase(),
    retry: mockUseCase(),
    artifact: mockUseCase({
      fileName: 'fv1.xml',
      contentType: 'application/xml; charset=utf-8',
      content: Buffer.from('<x/>'),
    }),
  };
  let controller: DocumentsController;
  beforeEach(async () => {
    controller = await build(DocumentsController, [
      [ListDocumentsUseCase, useCases.list],
      [GetDocumentStatsUseCase, useCases.stats],
      [GetDocumentUseCase, useCases.get],
      [IssueInvoiceUseCase, useCases.invoice],
      [IssueCreditNoteUseCase, useCases.credit],
      [IssueDebitNoteUseCase, useCases.debit],
      [SubmitDocumentUseCase, useCases.submit],
      [CheckDocumentStatusUseCase, useCases.status],
      [RetryPendingSubmissionsUseCase, useCases.retry],
      [GetDocumentArtifactUseCase, useCases.artifact],
    ]);
  });

  it('maps queries, bodies and ids to the use cases', async () => {
    const query = Object.assign(new ListDocumentsQueryDto(), {
      type: 'fv',
      status: 'accepted',
      from: '2026-01-01',
      page: 2,
      limit: 5,
      search: 'ana',
    });
    await controller.list(query);
    expect(useCases.list.execute).toHaveBeenCalledWith({
      criteria: { type: 'fv', status: 'accepted', from: '2026-01-01', to: undefined, search: 'ana' },
      page: { page: 2, limit: 5 },
    });
    await controller.stats({ from: '2026-01-01' });
    expect(useCases.stats.execute).toHaveBeenCalledWith({ from: '2026-01-01', to: undefined });

    const invoice = {
      customer: { name: 'A', idType: '13', idNumber: '123' },
      lines: [{ description: 'x', quantity: 1, unitPrice: 1 }],
      paymentMeans: { form: '1' as const, code: '10' },
    };
    await controller.createInvoice(invoice);
    expect(useCases.invoice.execute).toHaveBeenCalledWith(invoice);
    await controller.createCreditNote(3, { conceptCode: '2' });
    expect(useCases.credit.execute).toHaveBeenCalledWith({ invoiceId: 3, conceptCode: '2' });
    await controller.createDebitNote(3, { conceptCode: '1', lines: invoice.lines });
    expect(useCases.debit.execute).toHaveBeenCalledWith({ invoiceId: 3, conceptCode: '1', lines: invoice.lines });
    await controller.show(3);
    await controller.submit(3);
    await controller.statusCheck(3);
    await controller.retry();
    expect([useCases.get, useCases.submit, useCases.status].every((u) => u.execute.mock.calls[0][0] === 3)).toBe(true);
    expect(useCases.retry.execute).toHaveBeenCalled();
  });

  it('streams artifacts as attachments and rejects unknown kinds', async () => {
    const response = { setHeader: vi.fn() };
    const file = await controller.download(3, 'xml', response as never);
    expect(file).toBeInstanceOf(StreamableFile);
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="fv1.xml"');
    expect(useCases.artifact.execute).toHaveBeenCalledWith({ documentId: 3, kind: 'xml' });
    await expect(controller.download(3, 'pdf', response as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows admin and finance; bulk retry is admin only', () => {
    expect(roles(DocumentsController)).toEqual([Role.ADMIN, Role.FINANCE]);
    expect(roles(DocumentsController.prototype, 'retry')).toEqual([Role.ADMIN]);
  });
});

describe('HabilitationController', () => {
  it('runs the test set, reports progress and resets numbering (admin)', async () => {
    const run = mockUseCase();
    const progress = mockUseCase();
    const reset = mockUseCase([]);
    const controller = await build(HabilitationController, [
      [RunHabilitationTestSetUseCase, run],
      [GetTestSetProgressUseCase, progress],
      [ResetHabilitationNumberingUseCase, reset],
    ]);
    await controller.run({ invoices: 30, creditNotes: 10, debitNotes: 10 });
    await controller.showProgress();
    await controller.reset({ types: ['fv', 'nc'] });
    expect(run.execute).toHaveBeenCalledWith({ invoices: 30, creditNotes: 10, debitNotes: 10 });
    expect(reset.execute).toHaveBeenCalledWith(['fv', 'nc']);
    expect(roles(HabilitationController)).toEqual([Role.ADMIN]);
    expect(roles(HabilitationController.prototype, 'showProgress')).toEqual([Role.ADMIN, Role.FINANCE]);
  });
});

describe('CatalogsController', () => {
  it('serves catalogs and DANE cities', async () => {
    const catalogs = mockUseCase([]);
    const controller = await build(CatalogsController, [[GetCatalogUseCase, catalogs]]);
    await controller.show('payment-means');
    await controller.cities('70');
    expect(catalogs.execute.mock.calls).toEqual([
      [{ name: 'payment-means' }],
      [{ name: 'dane-cities', departmentCode: '70' }],
    ]);
    expect(roles(CatalogsController)).toEqual([Role.ADMIN, Role.FINANCE]);
  });
});
