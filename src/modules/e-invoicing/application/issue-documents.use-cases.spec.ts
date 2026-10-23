import { verify } from 'node:crypto';
import { FixedClock } from '../../../shared/testing/fakes.js';
import { computeUniqueCode } from '../domain/document-codes.js';
import { XadesSigner } from '../infrastructure/adapters/signing/xades-signer.js';
import { UblDocumentBuilder } from '../infrastructure/adapters/ubl/ubl-document-builder.js';
import { readZip, ZipArchiver } from '../infrastructure/adapters/zip/zip-archiver.js';
import { canonicalize } from '../infrastructure/xml/c14n.js';
import { findFirst, parseXml, textContent } from '../infrastructure/xml/xml-parser.js';
import { dianResponse, issuerConfig, resolution, VECTOR } from '../testing/fixtures.js';
import { createHarness, type Harness } from '../testing/harness.js';
import { createTestCertificate } from '../testing/self-signed-certificate.js';
import { CheckDocumentStatusUseCase } from './check-document-status.use-case.js';
import { E_INVOICING_EVENTS } from './integration-events.js';
import { IssueCreditNoteUseCase } from './issue-credit-note.use-case.js';
import { IssueDebitNoteUseCase } from './issue-debit-note.use-case.js';
import { type IssueInvoiceInput, IssueInvoiceUseCase } from './issue-invoice.use-case.js';
import { MAX_AUTOMATIC_ATTEMPTS, RetryPendingSubmissionsUseCase } from './retry-pending-submissions.use-case.js';
import { SubmitDocumentUseCase } from './submit-document.use-case.js';

const invoiceInput: IssueInvoiceInput = {
  customer: { name: 'María Gómez', idType: '13', idNumber: VECTOR.customerId, email: 'maria@example.com' },
  lines: [
    { description: 'Pensión marzo', code: 'PEN', quantity: 1, unitPrice: 350000 },
    { description: 'Uniforme', quantity: 1, unitPrice: 100000, taxTreatment: 'taxed', taxRate: 19 },
  ],
  paymentMeans: { form: '1', code: '10' },
};

describe('document issuance and submission', () => {
  let h: Harness;
  const issueInvoice = () => new IssueInvoiceUseCase(h.configs, h.issuer, h.submitter).execute(invoiceInput);

  beforeEach(() => {
    h = createHarness();
  });

  describe('IssueInvoiceUseCase', () => {
    it('numbers under lock, computes the CUFE, signs, sends and publishes the acceptance', async () => {
      const view = await issueInvoice();

      expect(view).toMatchObject({
        number: 'SETP990000001',
        status: 'accepted',
        subtotal: 450000,
        tax: 19000,
        total: 469000,
        attempts: 1,
      });
      expect(h.unitOfWork.transactions).toBe(1);
      expect(h.resolutions.locks).toEqual(['fv']);
      expect(view.cufe).toBe(
        computeUniqueCode({
          type: 'fv',
          number: 'SETP990000001',
          issueDate: '2026-03-15',
          issueTime: '10:00:00-05:00',
          lineExtensionCents: 45_000_000,
          vatCents: 1_900_000,
          payableCents: 46_900_000,
          issuerNit: VECTOR.nit,
          customerIdNumber: VECTOR.customerId,
          key: VECTOR.technicalKey,
          environment: '2',
        }),
      );
      expect(view.customer).toMatchObject({ cityCode: '70001', cityName: 'SINCELEJO' }); // issuer municipality, not Bogotá
      expect(h.gateway.calls).toEqual([
        { operation: 'SendBillSync', environment: '2', zipFileName: 'z0900123456000263b023381.zip' },
      ]);
      expect(view.hasAttachedDocument).toBe(true);
      expect(h.events.published).toEqual([
        {
          name: E_INVOICING_EVENTS.invoiceAccepted,
          occurredAt: h.clock.now(),
          payload: {
            dianInvoiceId: view.id,
            number: 'SETP990000001',
            cufe: view.cufe,
            paymentId: null,
            total: 469000,
            documentType: 'fv',
          },
        },
      ]);
    });

    it('takes consecutive numbers', async () => {
      await issueInvoice();
      await expect(issueInvoice()).resolves.toMatchObject({ number: 'SETP990000002' });
    });

    it('never issues unsigned documents: without certificate nothing is numbered', async () => {
      h.certificates.info = null;
      await expect(issueInvoice()).rejects.toMatchObject({ code: 'CERTIFICATE_NOT_CONFIGURED' });
      h.certificates.info = {
        subject: 'x',
        issuer: 'x',
        serialNumber: '1',
        validFrom: new Date('2020-01-01'),
        validTo: new Date('2021-01-01'),
      };
      await expect(issueInvoice()).rejects.toMatchObject({ code: 'CERTIFICATE_EXPIRED' });
      expect((await h.resolutions.findActive('fv'))!.current).toBe(990000000);
      expect(h.documents.store.all()).toHaveLength(0);
    });

    it('requires a complete configuration and an active resolution', async () => {
      h.configs.config = issuerConfig({ softwarePin: '' });
      await expect(issueInvoice()).rejects.toMatchObject({ code: 'E_INVOICING_NOT_CONFIGURED' });
      h.configs.config = issuerConfig();
      (await h.resolutions.findActive('fv'))!.deactivate();
      await expect(issueInvoice()).rejects.toMatchObject({ code: 'NO_ACTIVE_RESOLUTION' });
    });

    it('publishes the rejection with the DIAN rules', async () => {
      h.gateway.willRespond(
        dianResponse({ statusCode: '99', isValid: false, messages: ['Regla: FAD06, Rechazo: CUFE'] }),
      );
      const view = await issueInvoice();
      expect(view).toMatchObject({ status: 'rejected', errors: ['Regla: FAD06, Rechazo: CUFE'] });
      expect(h.events.published[0]).toMatchObject({
        name: E_INVOICING_EVENTS.invoiceRejected,
        payload: {
          dianInvoiceId: view.id,
          number: 'SETP990000001',
          errors: ['Regla: FAD06, Rechazo: CUFE'],
          documentType: 'fv',
        },
      });
    });

    it('leaves the document in send_error on transport failures (retryable, no event)', async () => {
      h.gateway.willFailTransport();
      const view = await issueInvoice();
      expect(view).toMatchObject({ status: 'send_error', attempts: 1 });
      expect(view.submissions[0]).toMatchObject({ outcome: 'transport_error' });
      expect(h.events.published).toEqual([]);

      const retried = await new SubmitDocumentUseCase(h.documents, h.submitter).execute(view.id);
      expect(retried).toMatchObject({ status: 'accepted', attempts: 2, cufe: view.cufe });
      await expect(new SubmitDocumentUseCase(h.documents, h.submitter).execute(view.id)).rejects.toMatchObject({
        code: 'DOCUMENT_NOT_SUBMITTABLE',
      });
    });

    it('uses SendTestSetAsync in habilitation with TestSetId and then GetStatusZip', async () => {
      h.configs.config = issuerConfig({ testSetId: 'set-1' });
      const view = await issueInvoice();
      expect(view).toMatchObject({ status: 'submitted', trackId: 'zip-key-1', operation: 'SendTestSetAsync' });
      expect(h.gateway.calls[0]).toMatchObject({ operation: 'SendTestSetAsync', testSetId: 'set-1' });

      const check = new CheckDocumentStatusUseCase(h.documents, h.submitter);
      h.gateway.willRespond(dianResponse({ statusCode: '66', isValid: false }));
      await expect(check.execute(view.id)).resolves.toMatchObject({ status: 'submitted' });
      h.gateway.willFailTransport();
      await expect(check.execute(view.id)).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
      await expect(check.execute(view.id)).resolves.toMatchObject({ status: 'accepted' });
      expect(h.gateway.calls.at(-1)).toEqual({ operation: 'GetStatusZip', environment: '2', trackId: 'zip-key-1' });
      expect(h.events.published.map((e) => e.name)).toEqual([E_INVOICING_EVENTS.invoiceAccepted]);
      await expect(check.execute(view.id)).rejects.toMatchObject({ code: 'STATUS_NOT_PENDING' });
    });

    it('refuses to send a document numbered for another environment', async () => {
      h.gateway.willFailTransport();
      const view = await issueInvoice();
      h.configs.config = issuerConfig({ environment: '1' });
      await expect(new SubmitDocumentUseCase(h.documents, h.submitter).execute(view.id)).rejects.toMatchObject({
        code: 'ENVIRONMENT_CHANGED',
      });
    });
  });

  describe('credit and debit notes', () => {
    let invoiceId: number;
    beforeEach(async () => {
      invoiceId = (await issueInvoice()).id;
      h.events.published.length = 0;
    });
    const creditNotes = () => new IssueCreditNoteUseCase(h.documents, h.issuer, h.submitter);

    it('annuls an invoice with its own numbering, explicit reference and CUDE', async () => {
      const note = await creditNotes().execute({ invoiceId, conceptCode: '2' });
      expect(note).toMatchObject({
        type: 'nc',
        number: 'NC990000001',
        total: 469000,
        status: 'accepted',
        billingReference: { documentId: invoiceId, number: 'SETP990000001' },
        discrepancy: { code: '2', description: 'Anulación de factura electrónica' },
      });
      expect(h.resolutions.locks).toEqual(['fv', 'nc']);
      expect(note.cufe).not.toBe((await h.documents.findById(invoiceId))!.uniqueCode);
      expect(h.events.published[0].payload).toMatchObject({ documentType: 'nc', number: 'NC990000001' });
    });

    it('does not credit more than the invoice balance', async () => {
      await creditNotes().execute({
        invoiceId,
        conceptCode: '3',
        description: 'Descuento',
        lines: [{ description: 'Descuento', quantity: 1, unitPrice: 400000 }],
      });
      await expect(
        creditNotes().execute({
          invoiceId,
          conceptCode: '3',
          lines: [{ description: 'Descuento', quantity: 1, unitPrice: 70000 }],
        }),
      ).rejects.toMatchObject({ code: 'CREDIT_EXCEEDS_INVOICE', details: { available: 69000 } });
    });

    it('requires lines for partial credits and a validated invoice', async () => {
      await expect(creditNotes().execute({ invoiceId, conceptCode: '1' })).rejects.toMatchObject({
        code: 'LINES_REQUIRED',
      });
      h.gateway.willFailTransport();
      const pending = await issueInvoice();
      await expect(creditNotes().execute({ invoiceId: pending.id, conceptCode: '2' })).rejects.toMatchObject({
        code: 'INVOICE_NOT_REFERENCEABLE',
      });
      await expect(creditNotes().execute({ invoiceId: 999, conceptCode: '2' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('issues debit notes referencing the invoice', async () => {
      const note = await new IssueDebitNoteUseCase(h.documents, h.issuer, h.submitter).execute({
        invoiceId,
        conceptCode: '1',
        lines: [{ description: 'Intereses de mora', quantity: 1, unitPrice: 15000 }],
      });
      expect(note).toMatchObject({
        type: 'nd',
        number: 'ND990000001',
        total: 15000,
        discrepancy: { code: '1', description: 'Intereses' },
        customer: { idNumber: VECTOR.customerId },
      });
    });
  });

  describe('RetryPendingSubmissionsUseCase', () => {
    it('resends signed and send_error documents below the attempts limit', async () => {
      h.gateway.willFailTransport().willFailTransport();
      const first = await issueInvoice();
      const second = await issueInvoice();
      const stuck = (await h.documents.findById(second.id))!;
      for (let i = 1; i < MAX_AUTOMATIC_ATTEMPTS; i++) stuck.recordTransportError('SendBillSync', 'x', h.clock.now());

      const summary = await new RetryPendingSubmissionsUseCase(h.documents, h.submitter).execute();
      expect(summary).toEqual({
        processed: 1,
        skipped: 1,
        results: [{ id: first.id, number: first.number, status: 'accepted' }],
      });
    });
  });

  it('end to end with the real UBL builder, XAdES signer and ZIP (DIAN double)', async () => {
    const certificate = createTestCertificate();
    const signer = new XadesSigner(
      {
        credentials: async () => ({
          privateKey: certificate.privateKey,
          certificate: certificate.certificate,
          certificateBase64: certificate.certificate.raw.toString('base64'),
        }),
      },
      new FixedClock(),
    );
    const zipper = new ZipArchiver();
    h = createHarness({ builder: new UblDocumentBuilder(), signer, zipper, resolutions: [resolution()] });
    const view = await issueInvoice();
    const [entry] = readZip(h.gateway.zips[0]);
    expect(entry.name).toBe('fv0900123456000263b023381.xml');
    const signedXml = entry.content.toString('utf8');
    expect(signedXml).toBe((await h.documents.findById(view.id))!.signedXml);
    const root = parseXml(signedXml);
    expect(textContent(findFirst(root, 'UUID')!)).toBe(view.cufe);
    const signature = findFirst(root, 'Signature')!;
    const value = Buffer.from(textContent(findFirst(signature, 'SignatureValue')!), 'base64');
    expect(
      verify(
        'sha256',
        Buffer.from(canonicalize(findFirst(signature, 'SignedInfo')!)),
        certificate.certificate.publicKey,
        value,
      ),
    ).toBe(true);
  });
});
