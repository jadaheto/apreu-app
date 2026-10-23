import { ElectronicDocument } from './electronic-document.js';
import { interpretDianResponse } from './dian-response.js';
import { customer, dianResponse, excludedLine, signedInvoice, taxedLine } from '../testing/fixtures.js';

const at = new Date('2026-03-15T15:00:00Z');
const draftInput = {
  type: 'fv' as const,
  reserved: { prefix: 'SETP', consecutive: 990000001, cycle: 0, number: 'SETP990000001' },
  environment: '2' as const,
  issuedAt: { date: '2026-03-15', time: '10:00:00-05:00' },
  customer: customer(),
  lines: [excludedLine(), taxedLine()],
  paymentMeans: { form: '1' as const, code: '10', dueDate: null },
};

describe('ElectronicDocument', () => {
  it('starts as draft with computed totals and becomes signed', () => {
    const document = ElectronicDocument.issue(draftInput);
    expect(document.status).toBe('draft');
    expect(document.totals.payableCents).toBe(35_000_000 + 11_900_000);
    expect(() => document.assertSubmittable()).toThrow(expect.objectContaining({ code: 'DOCUMENT_NOT_SUBMITTABLE' }));
    document.sign({
      uniqueCode: 'c',
      securityCode: 's',
      qrUrl: 'q',
      fileNames: { xml: 'a', zip: 'b' },
      signedXml: '<x/>',
    });
    expect(document.status).toBe('signed');
    expect(() =>
      document.sign({
        uniqueCode: 'c',
        securityCode: 's',
        qrUrl: 'q',
        fileNames: { xml: 'a', zip: 'b' },
        signedXml: '<x/>',
      }),
    ).toThrow();
  });

  it.each([
    [{ lines: [] }, 'LINES_REQUIRED'],
    [{ paymentMeans: { form: '2' as const, code: '10', dueDate: null } }, 'DUE_DATE_REQUIRED'],
    [{ paymentMeans: { form: '2' as const, code: '10', dueDate: '2026-01-01' } }, 'INVALID_DUE_DATE'],
    [{ paymentMeans: { form: '1' as const, code: '99', dueDate: null } }, 'INVALID_PAYMENT_MEANS'],
    [{ discrepancy: { code: '2', description: 'x' } }, 'UNEXPECTED_REFERENCE'],
    [{ type: 'nc' as const }, 'REFERENCE_REQUIRED'],
    [
      {
        type: 'nd' as const,
        billingReference: { documentId: 1, number: 'SETP1', uniqueCode: 'c', issueDate: '2026-03-01' },
        discrepancy: { code: '5', description: 'x' },
      },
      'INVALID_DISCREPANCY',
    ],
  ])('rejects %o', (override, code) => {
    expect(() => ElectronicDocument.issue({ ...draftInput, ...override })).toThrow(expect.objectContaining({ code }));
  });

  it('becomes accepted, keeps the ApplicationResponse and reports the final transition once', () => {
    const document = signedInvoice();
    const response = dianResponse();
    expect(document.applyResponse('SendBillSync', response, interpretDianResponse(response), at)).toBe(true);
    expect(document).toMatchObject({
      status: 'accepted',
      attempts: 1,
      operation: 'SendBillSync',
      trackId: 'cufe-1',
      isFinal: true,
    });
    expect(document.applicationResponse).toContain('ApplicationResponse');
    expect(document.submissions).toHaveLength(1);
    expect(() => document.assertSubmittable()).toThrow();
  });

  it('is rejected (terminal) with the DIAN errors', () => {
    const document = signedInvoice();
    const response = dianResponse({ statusCode: '99', isValid: false, messages: ['Regla: FAK61, Rechazo: x'] });
    document.applyResponse('SendBillSync', response, interpretDianResponse(response), at);
    expect(document).toMatchObject({ status: 'rejected', errors: ['Regla: FAK61, Rechazo: x'] });
  });

  it('stays retryable after a transport error and can be resent', () => {
    const document = signedInvoice();
    document.recordTransportError('SendBillSync', 'timeout', at);
    expect(document).toMatchObject({ status: 'send_error', attempts: 1, canBeSubmitted: true });
    const response = dianResponse();
    document.applyResponse('SendBillSync', response, interpretDianResponse(response), at);
    expect(document).toMatchObject({ status: 'accepted', attempts: 2 });
    expect(document.submissions.map((s) => s.outcome)).toEqual(['transport_error', 'accepted']);
  });

  it('handles the asynchronous test set: submitted → status query → accepted', () => {
    const document = signedInvoice();
    const receipt = dianResponse({
      statusCode: null,
      isValid: null,
      trackId: 'zip-1',
      applicationResponse: null,
      applicationResponseCode: null,
    });
    expect(document.applyResponse('SendTestSetAsync', receipt, interpretDianResponse(receipt), at)).toBe(false);
    expect(document).toMatchObject({ status: 'submitted', trackId: 'zip-1', isReferenceable: true });

    document.recordTransportError('GetStatusZip', 'timeout', at);
    expect(document).toMatchObject({ status: 'submitted', attempts: 1 });

    const response = dianResponse();
    expect(document.applyResponse('GetStatusZip', response, interpretDianResponse(response), at)).toBe(true);
    expect(document.status).toBe('accepted');
    expect(() => document.assertStatusQueryable()).toThrow(expect.objectContaining({ code: 'STATUS_NOT_PENDING' }));
  });

  it('only accepted documents get an AttachedDocument and can be referenced', () => {
    const document = signedInvoice();
    expect(document.isReferenceable).toBe(false);
    expect(() => document.attachContainer('<a/>')).toThrow(expect.objectContaining({ code: 'DOCUMENT_NOT_ACCEPTED' }));
    const response = dianResponse();
    document.applyResponse('SendBillSync', response, interpretDianResponse(response), at);
    document.attachContainer('<a/>');
    expect(document).toMatchObject({ attachedDocument: '<a/>', isReferenceable: true });
  });

  it('assigns persisted submission ids', () => {
    const document = signedInvoice();
    document.recordTransportError('SendBillSync', 'x', at);
    document.assignSubmissionIds([7]);
    expect(document.submissions[0].id).toBe(7);
    expect(() => document.assignSubmissionIds([8])).toThrow();
  });
});
