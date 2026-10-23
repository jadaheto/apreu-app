import { Injectable } from '@nestjs/common';
import {
  SIGNATURE_PLACEHOLDER,
  type UblBuildInput,
  type UblDocumentBuilderPort,
} from '../../../application/ports/ubl-document-builder.port.js';
import { Amounts } from '../../../domain/amounts.js';
import type { DocumentType } from '../../../domain/catalogs.js';
import { uniqueCodeScheme } from '../../../domain/document-codes.js';
import type { DocumentLine, DocumentTotals } from '../../../domain/document-line.js';
import type { ElectronicDocument } from '../../../domain/electronic-document.js';
import type { IssuerConfig } from '../../../domain/issuer-config.js';
import type { NumberingResolution } from '../../../domain/numbering-resolution.js';
import type { Party } from '../../../domain/party.js';
import { comment, el, serializeDocument, type XmlElement } from '../../xml/xml-writer.js';
import { address, amount, companyId, DIAN_AGENCY, DIAN_NIT, rootNamespaces, vatScheme } from './ubl-common.js';

interface Layout {
  root: string;
  namespace: string;
  customizationId: string;
  profileId: string;
  typeCode: XmlElement | null;
  lineTag: string;
  quantityTag: string;
  totalTag: string;
}

const LAYOUTS: Record<DocumentType, Layout> = {
  fv: {
    root: 'Invoice',
    namespace: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    customizationId: '10',
    profileId: 'DIAN 2.1: Factura Electrónica de Venta',
    typeCode: el('cbc:InvoiceTypeCode', {}, '01'),
    lineTag: 'cac:InvoiceLine',
    quantityTag: 'cbc:InvoicedQuantity',
    totalTag: 'cac:LegalMonetaryTotal',
  },
  nc: {
    root: 'CreditNote',
    namespace: 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2',
    customizationId: '20',
    profileId: 'DIAN 2.1: Nota Crédito de Factura Electrónica de Venta',
    typeCode: el('cbc:CreditNoteTypeCode', {}, '91'),
    lineTag: 'cac:CreditNoteLine',
    quantityTag: 'cbc:CreditedQuantity',
    totalTag: 'cac:LegalMonetaryTotal',
  },
  nd: {
    root: 'DebitNote',
    namespace: 'urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2',
    customizationId: '30',
    profileId: 'DIAN 2.1: Nota Débito de Factura Electrónica de Venta',
    typeCode: null,
    lineTag: 'cac:DebitNoteLine',
    quantityTag: 'cbc:DebitedQuantity',
    totalTag: 'cac:RequestedMonetaryTotal',
  },
};

const UNIT_CODE = 'ZZ';

/**
 * UBL 2.1 generator for invoices, credit notes and debit notes (legacy
 * `api/dian/InvoiceGenerator.php`, same tree and serialization), with the
 * corrections listed in the functional analysis:
 *
 * - `InvoiceControl` (resolution) only in invoices; notes have their own numbering.
 * - Notes reference the requested invoice in `DiscrepancyResponse/ReferenceID`
 *   and `BillingReference` (no hard-coded `SETP990000001`).
 * - `PaymentMeans/ID` = payment form (1 cash / 2 credit) and `PaymentDueDate` for credit.
 * - VAT-excluded lines (educational services) carry no `TaxTotal`; the header
 *   `TaxTotal` only groups reported taxes and is omitted when there are none;
 *   `TaxExclusiveAmount` is the taxable base (FAU04).
 * - Postal code emitted, `TaxLevelCode@listName` from the configured VAT regime,
 *   customer `PartyIdentification`, no empty `CorporateRegistrationScheme`.
 */
@Injectable()
export class UblDocumentBuilder implements UblDocumentBuilderPort {
  build({ document, issuer, resolution, uniqueCode, securityCode, qrUrl }: UblBuildInput): string {
    const layout = LAYOUTS[document.type];
    const totals = document.totals;
    const root = el(
      layout.root,
      { ...rootNamespaces(layout.namespace), 'xsi:schemaLocation': schemaLocation(layout.root) },
      [
        el('ext:UBLExtensions', {}, [
          el('ext:UBLExtension', {}, [
            el('ext:ExtensionContent', {}, [this.dianExtensions(document, issuer, resolution, securityCode, qrUrl)]),
          ]),
          el('ext:UBLExtension', {}, [el('ext:ExtensionContent', {}, [comment(SIGNATURE_PLACEHOLDER.slice(4, -3))])]),
        ]),
        el('cbc:UBLVersionID', {}, 'UBL 2.1'),
        el('cbc:CustomizationID', {}, layout.customizationId),
        el('cbc:ProfileID', {}, layout.profileId),
        el('cbc:ProfileExecutionID', {}, document.environment),
        el('cbc:ID', {}, document.number),
        el('cbc:UUID', { schemeID: document.environment, schemeName: uniqueCodeScheme(document.type) }, uniqueCode),
        el('cbc:IssueDate', {}, document.issueDate),
        el('cbc:IssueTime', {}, document.issueTime),
        layout.typeCode,
        document.notes && el('cbc:Note', {}, document.notes),
        el('cbc:DocumentCurrencyCode', {}, 'COP'),
        el('cbc:LineCountNumeric', {}, String(document.lines.length)),
        el('cac:InvoicePeriod', {}, [
          el('cbc:StartDate', {}, document.issueDate),
          el('cbc:EndDate', {}, document.issueDate),
          el('cbc:DescriptionCode', {}, '2'),
        ]),
        ...this.reference(document),
        this.supplier(issuer, document.prefix),
        this.customer(document.customer),
        this.paymentMeans(document),
        totals.taxSubtotals.length > 0 && this.taxTotal(totals),
        el(layout.totalTag, {}, [
          amount('cbc:LineExtensionAmount', totals.lineExtensionCents),
          amount('cbc:TaxExclusiveAmount', totals.taxExclusiveCents),
          amount('cbc:TaxInclusiveAmount', totals.payableCents),
          amount('cbc:PayableAmount', totals.payableCents),
        ]),
        ...document.lines.map((line, index) => this.line(document.type, layout, line, index)),
      ],
    );
    return serializeDocument(root);
  }

  private dianExtensions(
    document: ElectronicDocument,
    issuer: IssuerConfig,
    resolution: NumberingResolution,
    securityCode: string,
    qrUrl: string,
  ): XmlElement {
    return el('sts:DianExtensions', {}, [
      document.type === 'fv' &&
        el('sts:InvoiceControl', {}, [
          el('sts:InvoiceAuthorization', {}, resolution.resolutionNumber ?? ''),
          el('sts:AuthorizationPeriod', {}, [
            el('cbc:StartDate', {}, resolution.validFrom ?? ''),
            el('cbc:EndDate', {}, resolution.validTo ?? ''),
          ]),
          el('sts:AuthorizedInvoices', {}, [
            el('sts:Prefix', {}, resolution.prefix),
            el('sts:From', {}, String(resolution.rangeFrom)),
            el('sts:To', {}, String(resolution.rangeTo)),
          ]),
        ]),
      el('sts:InvoiceSource', {}, [
        el(
          'cbc:IdentificationCode',
          {
            listAgencyID: '6',
            listAgencyName: 'United Nations Economic Commission for Europe',
            listSchemeURI: 'urn:oasis:names:specification:ubl:codelist:gc:CountryIdentificationCode-2.1',
          },
          'CO',
        ),
      ]),
      el('sts:SoftwareProvider', {}, [
        el('sts:ProviderID', { ...DIAN_AGENCY, schemeID: issuer.dv, schemeName: '31' }, issuer.nit),
        el('sts:SoftwareID', { ...DIAN_AGENCY }, issuer.softwareId),
      ]),
      el('sts:SoftwareSecurityCode', { ...DIAN_AGENCY }, securityCode),
      el('sts:AuthorizationProvider', {}, [
        el('sts:AuthorizationProviderID', { ...DIAN_AGENCY, schemeID: '4', schemeName: '31' }, DIAN_NIT),
      ]),
      el('sts:QRCode', {}, qrUrl),
    ]);
  }

  private reference(document: ElectronicDocument): XmlElement[] {
    const reference = document.billingReference;
    const discrepancy = document.discrepancy;
    if (document.type === 'fv' || !reference || !discrepancy) return [];
    return [
      el('cac:DiscrepancyResponse', {}, [
        el('cbc:ReferenceID', {}, reference.number),
        el('cbc:ResponseCode', {}, discrepancy.code),
        el('cbc:Description', {}, discrepancy.description),
      ]),
      el('cac:BillingReference', {}, [
        el('cac:InvoiceDocumentReference', {}, [
          el('cbc:ID', {}, reference.number),
          el('cbc:UUID', { schemeName: 'CUFE-SHA384' }, reference.uniqueCode),
          el('cbc:IssueDate', {}, reference.issueDate),
        ]),
      ]),
    ];
  }

  private supplier(issuer: IssuerConfig, prefix: string): XmlElement {
    const id = companyId(issuer.nit, '31', issuer.dv);
    return el('cac:AccountingSupplierParty', {}, [
      el('cbc:AdditionalAccountID', {}, issuer.personType),
      el('cac:Party', {}, [
        el('cac:PartyName', {}, [el('cbc:Name', {}, issuer.businessName)]),
        el('cac:PhysicalLocation', {}, [address('cac:Address', issuer.location, issuer.address, issuer.postalCode)]),
        el('cac:PartyTaxScheme', {}, [
          el('cbc:RegistrationName', {}, issuer.businessName),
          id,
          el('cbc:TaxLevelCode', { listName: issuer.vatRegime }, issuer.taxResponsibilities),
          address('cac:RegistrationAddress', issuer.location, issuer.address, issuer.postalCode),
          vatScheme(),
        ]),
        el('cac:PartyLegalEntity', {}, [
          el('cbc:RegistrationName', {}, issuer.businessName),
          id,
          el('cac:CorporateRegistrationScheme', {}, [el('cbc:ID', {}, prefix)]),
        ]),
        el('cac:Contact', {}, [
          el('cbc:Name', {}, issuer.contactName),
          issuer.phone && el('cbc:Telephone', {}, issuer.phone),
          issuer.email && el('cbc:ElectronicMail', {}, issuer.email),
        ]),
        issuer.personType === '2' &&
          el('cac:Person', {}, [
            el('cbc:FirstName', {}, issuer.firstName),
            el('cbc:FamilyName', {}, issuer.familyName),
          ]),
      ]),
    ]);
  }

  private customer(party: Party): XmlElement {
    const id = companyId(party.idNumber, party.idType, party.dv);
    return el('cac:AccountingCustomerParty', {}, [
      el('cbc:AdditionalAccountID', {}, party.personType),
      el('cac:Party', {}, [
        el('cac:PartyIdentification', {}, [
          el('cbc:ID', { schemeID: party.dv ?? undefined, schemeName: party.idType }, party.idNumber),
        ]),
        el('cac:PartyName', {}, [el('cbc:Name', {}, party.name)]),
        el('cac:PhysicalLocation', {}, [address('cac:Address', party.location, party.address, null)]),
        el('cac:PartyTaxScheme', {}, [
          el('cbc:RegistrationName', {}, party.name),
          id,
          el('cbc:TaxLevelCode', { listName: party.vatRegime }, party.taxLevelCode),
          address('cac:RegistrationAddress', party.location, party.address, null),
          vatScheme(),
        ]),
        el('cac:PartyLegalEntity', {}, [el('cbc:RegistrationName', {}, party.name), id]),
        el('cac:Contact', {}, [
          el('cbc:Name', {}, party.name),
          party.phone && el('cbc:Telephone', {}, party.phone),
          party.email && el('cbc:ElectronicMail', {}, party.email),
        ]),
        party.personType === '2' &&
          el('cac:Person', {}, [el('cbc:FirstName', {}, party.firstName), el('cbc:FamilyName', {}, party.familyName)]),
      ]),
    ]);
  }

  private paymentMeans(document: ElectronicDocument): XmlElement {
    const means = document.paymentMeans;
    return el('cac:PaymentMeans', {}, [
      el('cbc:ID', {}, means.form),
      el('cbc:PaymentMeansCode', {}, means.code),
      means.dueDate && el('cbc:PaymentDueDate', {}, means.dueDate),
    ]);
  }

  private taxTotal(totals: DocumentTotals): XmlElement {
    return el('cac:TaxTotal', {}, [
      amount('cbc:TaxAmount', totals.taxCents),
      ...totals.taxSubtotals.map((group) => taxSubtotal(group.taxableCents, group.taxCents, group.rateBasisPoints)),
    ]);
  }

  private line(type: DocumentType, layout: Layout, line: DocumentLine, index: number): XmlElement {
    const quantity = Amounts.format(line.quantityHundredths);
    const isInvoice = type === 'fv';
    return el(layout.lineTag, {}, [
      el('cbc:ID', {}, String(index + 1)),
      el(layout.quantityTag, { unitCode: UNIT_CODE }, quantity),
      amount('cbc:LineExtensionAmount', line.lineTotalCents),
      isInvoice && el('cbc:FreeOfChargeIndicator', {}, 'false'),
      line.reportsTax &&
        el('cac:TaxTotal', {}, [
          amount('cbc:TaxAmount', line.taxCents),
          taxSubtotal(line.lineTotalCents, line.taxCents, line.taxRateBasisPoints),
        ]),
      el('cac:Item', {}, [
        el('cbc:Description', {}, line.description),
        isInvoice &&
          el('cac:StandardItemIdentification', {}, [
            el(
              'cbc:ID',
              { schemeID: '999', schemeName: 'Estándar de adopción del contribuyente' },
              line.code || String(index + 1),
            ),
          ]),
      ]),
      el('cac:Price', {}, [
        amount('cbc:PriceAmount', line.unitPriceCents),
        isInvoice && el('cbc:BaseQuantity', { unitCode: UNIT_CODE }, quantity),
      ]),
    ]);
  }
}

function taxSubtotal(taxableCents: number, taxCents: number, rateBasisPoints: number): XmlElement {
  return el('cac:TaxSubtotal', {}, [
    amount('cbc:TaxableAmount', taxableCents),
    amount('cbc:TaxAmount', taxCents),
    el('cac:TaxCategory', {}, [el('cbc:Percent', {}, Amounts.format(rateBasisPoints)), vatScheme()]),
  ]);
}

const schemaLocation = (root: string): string =>
  `urn:oasis:names:specification:ubl:schema:xsd:${root}-2 http://docs.oasis-open.org/ubl/os-UBL-2.1/xsd/maindoc/UBL-${root}-2.1.xsd`;
