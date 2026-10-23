import { SIGNATURE_PLACEHOLDER } from '../../../application/ports/ubl-document-builder.port.js';
import { interpretDianResponse } from '../../../domain/dian-response.js';
import { dianResponse, issuerConfig, signedInvoice } from '../../../testing/fixtures.js';
import { childElements, findFirst, localNameOf, parseXml, textContent } from '../../xml/xml-parser.js';
import { AttachedDocumentBuilder } from './attached-document-builder.js';

describe('AttachedDocumentBuilder', () => {
  it('embeds the signed invoice and the ApplicationResponse with the validation result', () => {
    const invoice = signedInvoice();
    const response = dianResponse({
      applicationResponse:
        '<ApplicationResponse xmlns:cbc="urn:cbc"><cbc:IssueDate>2026-03-16</cbc:IssueDate><cbc:IssueTime>08:00:00-05:00</cbc:IssueTime></ApplicationResponse>',
    });
    invoice.applyResponse('SendBillSync', response, interpretDianResponse(response), new Date());

    const xml = new AttachedDocumentBuilder().build(invoice, issuerConfig(), {
      date: '2026-03-17',
      time: '09:00:00-05:00',
    });
    expect(xml).toContain(SIGNATURE_PLACEHOLDER);
    const root = parseXml(xml.replace(SIGNATURE_PLACEHOLDER, ''));
    const child = (name: string) => textContent(childElements(root).find((c) => localNameOf(c.name) === name)!);
    expect(root.name).toBe('AttachedDocument');
    expect(child('CustomizationID')).toBe('Documentos adjuntos');
    expect(child('ParentDocumentID')).toBe('SETP990000001');
    expect(child('IssueDate')).toBe('2026-03-17');
    expect(textContent(findFirst(findFirst(root, 'Attachment')!, 'Description')!)).toBe('<Invoice/>');
    const reference = findFirst(root, 'ParentDocumentLineReference')!;
    expect(textContent(findFirst(reference, 'UUID')!)).toBe('cufe-1');
    expect(textContent(findFirst(findFirst(reference, 'Attachment')!, 'Description')!)).toContain(
      '<ApplicationResponse',
    );
    expect(textContent(findFirst(reference, 'ValidationResultCode')!)).toBe('02');
    expect(textContent(findFirst(reference, 'ValidationDate')!)).toBe('2026-03-16');
    expect(textContent(findFirst(reference, 'ValidationTime')!)).toBe('08:00:00-05:00');
    expect(textContent(findFirst(findFirst(root, 'ReceiverParty')!, 'CompanyID')!)).toBe('1065432198');
  });
});
