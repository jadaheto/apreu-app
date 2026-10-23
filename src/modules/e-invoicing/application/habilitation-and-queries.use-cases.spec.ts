import { FakeUnitOfWork } from '../../../shared/testing/fakes.js';
import { issuerConfig, resolution } from '../testing/fixtures.js';
import { createHarness, type Harness } from '../testing/harness.js';
import { GetDocumentArtifactUseCase } from './get-document-artifact.use-case.js';
import { GetDocumentStatsUseCase } from './get-document-stats.use-case.js';
import { GetDocumentUseCase } from './get-document.use-case.js';
import { GetTestSetProgressUseCase } from './get-test-set-progress.use-case.js';
import { IssueInvoiceUseCase } from './issue-invoice.use-case.js';
import { ListDocumentsUseCase } from './list-documents.use-case.js';
import { ResetHabilitationNumberingUseCase } from './reset-habilitation-numbering.use-case.js';
import { RunHabilitationTestSetUseCase } from './run-habilitation-test-set.use-case.js';

describe('habilitation', () => {
  let h: Harness;
  const runTestSet = () =>
    new RunHabilitationTestSetUseCase(h.configs, h.resolutions, h.executor, h.issuer, h.submitter);

  beforeEach(() => {
    h = createHarness({ config: issuerConfig({ testSetId: 'set-1' }) });
  });

  it('sends invoices first and then notes referencing them, in background', async () => {
    await expect(runTestSet().execute({ invoices: 3, creditNotes: 2, debitNotes: 1 })).resolves.toEqual({
      invoices: 3,
      creditNotes: 2,
      debitNotes: 1,
    });
    expect(h.executor.tasks).toHaveLength(1);
    await h.executor.flush();

    expect(h.gateway.calls.map((c) => c.operation)).toEqual(Array(6).fill('SendTestSetAsync'));
    const documents = h.documents.store.all();
    expect(documents.map((d) => d.number)).toEqual([
      'SETP990000001',
      'SETP990000002',
      'SETP990000003',
      'NC990000001',
      'NC990000002',
      'ND990000001',
    ]);
    expect(documents[3].billingReference?.number).toBe('SETP990000001');
    expect(documents.filter((d) => d.type === 'fv').some((d) => d.lines.some((l) => l.taxTreatment === 'taxed'))).toBe(
      true,
    );

    const progress = await new GetTestSetProgressUseCase(h.documents, h.configs).execute();
    expect(progress).toEqual({
      testSetId: 'set-1',
      environment: '2',
      counts: { fv: { submitted: 3 }, nc: { submitted: 2 }, nd: { submitted: 1 } },
    });
  });

  it('validates the configuration and the plan', async () => {
    await expect(runTestSet().execute({ invoices: 0, creditNotes: 1, debitNotes: 0 })).rejects.toMatchObject({
      code: 'INVALID_TEST_SET_PLAN',
    });
    await expect(runTestSet().execute({ invoices: 101, creditNotes: 0, debitNotes: 0 })).rejects.toMatchObject({
      code: 'INVALID_TEST_SET_PLAN',
    });
    (await h.resolutions.findActive('nd'))!.deactivate();
    await expect(runTestSet().execute({ invoices: 1, creditNotes: 0, debitNotes: 1 })).rejects.toMatchObject({
      code: 'NO_ACTIVE_RESOLUTION',
    });
    h.configs.config = issuerConfig();
    await expect(runTestSet().execute({ invoices: 1, creditNotes: 0, debitNotes: 0 })).rejects.toMatchObject({
      code: 'TEST_SET_NOT_CONFIGURED',
    });
  });

  it('resets habilitation numbering without deleting documents', async () => {
    await runTestSet().execute({ invoices: 1, creditNotes: 0, debitNotes: 0 });
    await h.executor.flush();
    const reset = await new ResetHabilitationNumberingUseCase(h.configs, h.resolutions, new FakeUnitOfWork()).execute([
      'fv',
      'fv',
    ]);
    expect(reset).toEqual([expect.objectContaining({ docType: 'fv', current: 990000000, cycle: 1 })]);
    expect(h.documents.store.all()).toHaveLength(1);

    h.configs.config = issuerConfig({ environment: '1' });
    await expect(
      new ResetHabilitationNumberingUseCase(h.configs, h.resolutions, new FakeUnitOfWork()).execute(['fv']),
    ).rejects.toMatchObject({ code: 'RESET_NOT_ALLOWED' });
  });
});

describe('document queries and artifacts', () => {
  let h: Harness;
  let id: number;

  beforeEach(async () => {
    h = createHarness({ resolutions: [resolution()] });
    const issue = new IssueInvoiceUseCase(h.configs, h.issuer, h.submitter);
    id = (
      await issue.execute({
        customer: { name: 'Ana Ruiz', idType: '13', idNumber: '123456' },
        lines: [{ description: 'Pensión', quantity: 1, unitPrice: 1000 }],
        paymentMeans: { form: '1', code: '10' },
      })
    ).id;
    h.gateway.willFailTransport();
    await issue.execute({
      customer: { name: 'Beto Díaz', idType: '13', idNumber: '654321' },
      lines: [{ description: 'Pensión', quantity: 1, unitPrice: 2000 }],
      paymentMeans: { form: '1', code: '10' },
    });
  });

  it('lists with filters and computes stats', async () => {
    const page = await new ListDocumentsUseCase(h.documents).execute({
      criteria: { status: 'accepted' },
      page: { page: 1, limit: 10 },
    });
    expect(page).toMatchObject({ total: 1, items: [{ id, customerName: 'Ana Ruiz', total: 1000 }] });
    expect(
      (
        await new ListDocumentsUseCase(h.documents).execute({
          criteria: { search: 'beto' },
          page: { page: 1, limit: 10 },
        })
      ).total,
    ).toBe(1);
    await expect(new GetDocumentStatsUseCase(h.documents).execute({})).resolves.toEqual({
      counts: { fv: { accepted: 1, send_error: 1 }, nc: {}, nd: {} },
      acceptedInvoicesTotal: 1000,
    });
  });

  it('returns the detail with the submissions history', async () => {
    const view = await new GetDocumentUseCase(h.documents).execute(id);
    expect(view.submissions).toEqual([expect.objectContaining({ operation: 'SendBillSync', outcome: 'accepted' })]);
    await expect(new GetDocumentUseCase(h.documents).execute(404)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('serves the XML, ZIP, ApplicationResponse and AttachedDocument', async () => {
    const artifacts = new GetDocumentArtifactUseCase(h.documents, h.zipper, h.submitter);
    const xml = await artifacts.execute({ documentId: id, kind: 'xml' });
    expect(xml).toMatchObject({
      fileName: 'fv0900123456000263b023381.xml',
      contentType: 'application/xml; charset=utf-8',
    });
    expect(xml.content.toString()).toContain('<ds:Signature/>');
    expect((await artifacts.execute({ documentId: id, kind: 'zip' })).fileName).toBe('z0900123456000263b023381.zip');
    expect((await artifacts.execute({ documentId: id, kind: 'application-response' })).content.toString()).toContain(
      'ApplicationResponse',
    );
    expect((await artifacts.execute({ documentId: id, kind: 'attached-document' })).content.toString()).toContain(
      '<AttachedDocument>',
    );
    await expect(artifacts.execute({ documentId: id + 1, kind: 'attached-document' })).rejects.toMatchObject({
      code: 'ATTACHED_DOCUMENT_UNAVAILABLE',
    });
    await expect(artifacts.execute({ documentId: id + 1, kind: 'application-response' })).rejects.toMatchObject({
      code: 'ARTIFACT_UNAVAILABLE',
    });
  });
});
