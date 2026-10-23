import { interpretDianResponse } from '../../domain/dian-response.js';
import { ElectronicDocument } from '../../domain/electronic-document.js';
import { customer, dianResponse, signedInvoice, taxedLine } from '../../testing/fixtures.js';
import { ElectronicDocumentMapper } from './electronic-document.mapper.js';

describe('ElectronicDocumentMapper', () => {
  it('round-trips a document with lines, reference and DIAN answer', () => {
    const document = ElectronicDocument.issue({
      type: 'nc',
      reserved: { prefix: 'NC', consecutive: 5, cycle: 1, number: 'NC5' },
      environment: '2',
      issuedAt: { date: '2026-03-15', time: '10:00:00-05:00' },
      customer: customer(),
      lines: [taxedLine()],
      paymentMeans: { form: '2', code: '47', dueDate: '2026-04-01' },
      billingReference: { documentId: 3, number: 'SETP1', uniqueCode: 'cufe-ref', issueDate: '2026-03-01' },
      discrepancy: { code: '2', description: 'Anulación' },
      sourcePaymentId: 77,
    });
    document.sign({
      uniqueCode: 'cude',
      securityCode: 's',
      qrUrl: 'q',
      fileNames: { xml: 'nc1', zip: 'z1' },
      signedXml: '<CreditNote/>',
    });
    const response = dianResponse({ messages: ['Regla: X, Notificación: y'] });
    document.applyResponse('SendBillSync', response, interpretDianResponse(response), new Date('2026-03-15T15:00:00Z'));
    document.assignId(9);

    const row = ElectronicDocumentMapper.toPersistence(document);
    expect(row).toMatchObject({
      id: 9,
      invoiceNumber: 'NC5',
      numberingCycle: 1,
      subtotal: '100000.00',
      taxAmount: '19000.00',
      total: '119000.00',
      dianStatus: 'accepted_with_notices',
      paymentForm: '2',
      refCufe: 'cufe-ref',
      xmlFilename: 'nc1.xml',
      zipFilename: 'z1.zip',
      sourcePaymentId: 77,
    });
    expect(row.linesData![0]).toMatchObject({
      quantity: '1.00',
      unit_price: '100000.00',
      tax_percent: '19.00',
      tax_treatment: 'taxed',
    });

    const submissions = ElectronicDocumentMapper.newSubmissions(document);
    expect(submissions).toHaveLength(1);
    const restored = ElectronicDocumentMapper.toDomain(
      row,
      submissions.map((s, i) => Object.assign(s, { id: i + 1 })),
    );
    expect(restored).toMatchObject({
      number: 'NC5',
      status: 'accepted_with_notices',
      notices: ['Regla: X, Notificación: y'],
      billingReference: { number: 'SETP1' },
      discrepancy: { code: '2' },
    });
    expect(restored.totals).toEqual(document.totals);
    expect(restored.fileNames).toEqual({ xml: 'nc1', zip: 'z1' });
    expect(restored.submissions[0]).toMatchObject({ id: 1, outcome: 'accepted_with_notices' });
  });

  it('maps legacy statuses and lines without tax treatment', () => {
    const row = ElectronicDocumentMapper.toPersistence(signedInvoice());
    row.id = 1;
    row.dianStatus = 'sent';
    row.linesData = [{ description: 'Servicio', product_code: 'S1', quantity: 2, unit_price: 1000, tax_percent: 19 }];
    const restored = ElectronicDocumentMapper.toDomain(row);
    expect(restored.status).toBe('submitted');
    expect(restored.lines[0]).toMatchObject({
      taxTreatment: 'taxed',
      taxRateBasisPoints: 1900,
      quantityHundredths: 200,
    });
    row.dianStatus = 'pending';
    expect(ElectronicDocumentMapper.toDomain(row).status).toBe('draft');
  });
});
