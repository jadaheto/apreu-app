import { SIGNATURE_PLACEHOLDER } from '../../../application/ports/ubl-document-builder.port.js';
import { DocumentLine } from '../../../domain/document-line.js';
import { ElectronicDocument } from '../../../domain/electronic-document.js';
import { customer, excludedLine, issuerConfig, resolution, taxedLine } from '../../../testing/fixtures.js';
import {
  attributeOf,
  childElements,
  findAll,
  findFirst,
  localNameOf,
  type ParsedElement,
  parseXml,
  textContent,
} from '../../xml/xml-parser.js';
import { UblDocumentBuilder } from './ubl-document-builder.js';

const builder = new UblDocumentBuilder();
const text = (root: ParsedElement, path: string): string | null => {
  let current: ParsedElement | null = root;
  for (const name of path.split('/')) {
    current = current ? (childElements(current).find((child) => localNameOf(child.name) === name) ?? null) : null;
  }
  return current ? textContent(current) : null;
};

function build(type: 'fv' | 'nc' | 'nd', overrides: Partial<Parameters<typeof ElectronicDocument.issue>[0]> = {}) {
  const document = ElectronicDocument.issue({
    type,
    reserved: {
      prefix: type === 'fv' ? 'SETP' : type.toUpperCase(),
      consecutive: 990000001,
      cycle: 0,
      number: `${type === 'fv' ? 'SETP' : type.toUpperCase()}990000001`,
    },
    environment: '2',
    issuedAt: { date: '2026-03-15', time: '10:00:00-05:00' },
    customer: customer(),
    lines: [excludedLine(), taxedLine()],
    paymentMeans: { form: '2', code: '47', dueDate: '2026-04-15' },
    notes: 'Pensión & uniforme',
    ...(type === 'fv'
      ? {}
      : {
          billingReference: { documentId: 1, number: 'SETP990000010', uniqueCode: 'cufe-ref', issueDate: '2026-03-01' },
          discrepancy: { code: type === 'nc' ? '2' : '1', description: 'Corrección' },
        }),
    ...overrides,
  });
  const xml = builder.build({
    document,
    issuer: issuerConfig(),
    resolution: resolution({ docType: type }),
    uniqueCode: 'cufe-123',
    securityCode: 'ssc-456',
    qrUrl: 'https://qr',
  });
  return { xml, root: parseXml(xml.replace(SIGNATURE_PLACEHOLDER, '')) };
}

describe('UblDocumentBuilder', () => {
  it('emits the invoice tree with resolution control, codes and the signature placeholder', () => {
    const { xml, root } = build('fv');
    expect(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac=',
      ),
    ).toBe(true);
    expect(xml).toContain(`<ext:ExtensionContent>\n        ${SIGNATURE_PLACEHOLDER}\n      </ext:ExtensionContent>`);
    expect(
      text(root, 'UBLExtensions/UBLExtension/ExtensionContent/DianExtensions/InvoiceControl/InvoiceAuthorization'),
    ).toBe('18760000001');
    expect(text(root, 'UBLExtensions/UBLExtension/ExtensionContent/DianExtensions/SoftwareSecurityCode')).toBe(
      'ssc-456',
    );
    expect(text(root, 'UBLExtensions/UBLExtension/ExtensionContent/DianExtensions/SoftwareProvider/ProviderID')).toBe(
      '900123456',
    );
    expect(text(root, 'CustomizationID')).toBe('10');
    expect(text(root, 'ID')).toBe('SETP990000001');
    expect(attributeOf(findFirst(root, 'UUID')!, 'schemeName')).toBe('CUFE-SHA384');
    expect(text(root, 'UUID')).toBe('cufe-123');
    expect(text(root, 'InvoiceTypeCode')).toBe('01');
    expect(text(root, 'Note')).toBe('Pensión & uniforme');
    expect(text(root, 'LineCountNumeric')).toBe('2');
  });

  it('reports PaymentMeans ID as the payment form with due date', () => {
    const { root } = build('fv');
    expect(text(root, 'PaymentMeans/ID')).toBe('2');
    expect(text(root, 'PaymentMeans/PaymentMeansCode')).toBe('47');
    expect(text(root, 'PaymentMeans/PaymentDueDate')).toBe('2026-04-15');
  });

  it('does not report VAT on excluded lines and uses the taxable base as TaxExclusiveAmount', () => {
    const { root } = build('fv');
    const lines = findAll(root, 'InvoiceLine');
    expect(findFirst(lines[0], 'TaxTotal')).toBeNull();
    expect(text(lines[1], 'TaxTotal/TaxSubtotal/TaxCategory/Percent')).toBe('19.00');
    expect(text(root, 'TaxTotal/TaxAmount')).toBe('19000.00');
    expect(findAll(root, 'TaxTotal').filter((t) => t.parent === root)).toHaveLength(1);
    expect(text(root, 'LegalMonetaryTotal/LineExtensionAmount')).toBe('450000.00');
    expect(text(root, 'LegalMonetaryTotal/TaxExclusiveAmount')).toBe('100000.00');
    expect(text(root, 'LegalMonetaryTotal/PayableAmount')).toBe('469000.00');
    expect(text(lines[0], 'Item/StandardItemIdentification/ID')).toBe('PEN');
    expect(text(lines[0], 'Price/BaseQuantity')).toBe('1.00');
  });

  it('omits the header TaxTotal when every line is excluded', () => {
    const { root } = build('fv', { lines: [excludedLine()] });
    expect(childElements(root).some((child) => localNameOf(child.name) === 'TaxTotal')).toBe(false);
    expect(text(root, 'LegalMonetaryTotal/TaxExclusiveAmount')).toBe('0.00');
  });

  it('emits parties with DV, postal code, VAT regime and the Person group of natural persons (FAK61)', () => {
    const { root } = build('fv');
    const supplier = findFirst(root, 'AccountingSupplierParty')!;
    expect(attributeOf(findFirst(supplier, 'CompanyID')!, 'schemeID')).toBe('8');
    expect(attributeOf(findFirst(supplier, 'TaxLevelCode')!, 'listName')).toBe('49');
    expect(text(supplier, 'Party/PartyLegalEntity/CorporateRegistrationScheme/ID')).toBe('SETP');
    const buyer = findFirst(root, 'AccountingCustomerParty')!;
    expect(text(buyer, 'AdditionalAccountID')).toBe('2');
    expect(text(buyer, 'Party/PartyIdentification/ID')).toBe('1065432198');
    expect(text(buyer, 'Party/Person/FirstName')).toBe('María');
    expect(text(buyer, 'Party/PhysicalLocation/Address/ID')).toBe('70001');
    expect(findFirst(buyer, 'CorporateRegistrationScheme')).toBeNull();

    const legal = build('fv', {
      customer: customer({ idType: '31', idNumber: '800197268', name: 'Proveedor SAS' }),
    }).root;
    const legalBuyer = findFirst(legal, 'AccountingCustomerParty')!;
    expect(text(legalBuyer, 'AdditionalAccountID')).toBe('1');
    expect(attributeOf(findFirst(legalBuyer, 'CompanyID')!, 'schemeID')).toBe('4');
    expect(findFirst(legalBuyer, 'Person')).toBeNull();
  });

  it('credit notes reference the requested invoice and have no InvoiceControl', () => {
    const { root } = build('nc');
    expect(root.name).toBe('CreditNote');
    expect(findFirst(root, 'InvoiceControl')).toBeNull();
    expect(text(root, 'CustomizationID')).toBe('20');
    expect(text(root, 'CreditNoteTypeCode')).toBe('91');
    expect(attributeOf(findFirst(root, 'UUID')!, 'schemeName')).toBe('CUDE-SHA384');
    expect(text(root, 'DiscrepancyResponse/ReferenceID')).toBe('SETP990000010');
    expect(text(root, 'DiscrepancyResponse/ResponseCode')).toBe('2');
    expect(text(root, 'BillingReference/InvoiceDocumentReference/UUID')).toBe('cufe-ref');
    expect(text(root, 'BillingReference/InvoiceDocumentReference/IssueDate')).toBe('2026-03-01');
    expect(findAll(root, 'CreditNoteLine')).toHaveLength(2);
    expect(text(findAll(root, 'CreditNoteLine')[0], 'CreditedQuantity')).toBe('1.00');
  });

  it('debit notes use RequestedMonetaryTotal and DebitNoteLine', () => {
    const { root } = build('nd', {
      lines: [DocumentLine.create({ description: 'Intereses', quantity: 1, unitPrice: 15000 })],
    });
    expect(root.name).toBe('DebitNote');
    expect(text(root, 'CustomizationID')).toBe('30');
    expect(text(root, 'RequestedMonetaryTotal/PayableAmount')).toBe('15000.00');
    expect(findFirst(root, 'LegalMonetaryTotal')).toBeNull();
    expect(text(findFirst(root, 'DebitNoteLine')!, 'DebitedQuantity')).toBe('1.00');
  });
});
