import { Injectable } from '@nestjs/common';
import type { AttachedDocumentBuilderPort } from '../../../application/ports/attached-document-builder.port.js';
import { SIGNATURE_PLACEHOLDER } from '../../../application/ports/ubl-document-builder.port.js';
import type { BogotaDateTime } from '../../../domain/bogota-time.js';
import { uniqueCodeScheme } from '../../../domain/document-codes.js';
import type { ElectronicDocument } from '../../../domain/electronic-document.js';
import type { IssuerConfig } from '../../../domain/issuer-config.js';
import { childElements, localNameOf, parseXml, textContent } from '../../xml/xml-parser.js';
import { cdata, comment, el, serializeDocument, type XmlElement } from '../../xml/xml-writer.js';
import { companyId, rootNamespaces, vatScheme } from './ubl-common.js';

const ATTACHED_DOCUMENT_NS = 'urn:oasis:names:specification:ubl:schema:xsd:AttachedDocument-2';
const DIAN_VALIDATOR = 'Unidad Especial Dirección de Impuestos y Aduanas Nacionales';

/**
 * `AttachedDocument` (Anexo Técnico §"Documento adjunto"): container delivered
 * to the acquirer with the signed document and the DIAN `ApplicationResponse`
 * embedded as CDATA, plus the validation result. The structure follows the
 * reference sample `xml/plantilla.xml` of the legacy repository.
 */
@Injectable()
export class AttachedDocumentBuilder implements AttachedDocumentBuilderPort {
  build(document: ElectronicDocument, issuer: IssuerConfig, issuedAt: BogotaDateTime): string {
    const validation = validationTimestamp(document.applicationResponse ?? '', issuedAt);
    const customer = document.customer;
    const root = el('AttachedDocument', rootNamespaces(ATTACHED_DOCUMENT_NS), [
      el('ext:UBLExtensions', {}, [
        el('ext:UBLExtension', {}, [el('ext:ExtensionContent', {}, [comment(SIGNATURE_PLACEHOLDER.slice(4, -3))])]),
      ]),
      el('cbc:UBLVersionID', {}, 'UBL 2.1'),
      el('cbc:CustomizationID', {}, 'Documentos adjuntos'),
      el('cbc:ProfileID', {}, 'Factura Electrónica de Venta'),
      el('cbc:ProfileExecutionID', {}, document.environment),
      el('cbc:ID', {}, document.number),
      el('cbc:IssueDate', {}, issuedAt.date),
      el('cbc:IssueTime', {}, issuedAt.time),
      el('cbc:DocumentType', {}, 'Contenedor de Factura Electrónica'),
      el('cbc:ParentDocumentID', {}, document.number),
      el('cac:SenderParty', {}, [
        partyTaxScheme(
          issuer.businessName,
          companyId(issuer.nit, '31', issuer.dv),
          issuer.vatRegime,
          issuer.taxResponsibilities,
        ),
      ]),
      el('cac:ReceiverParty', {}, [
        partyTaxScheme(
          customer.name,
          companyId(customer.idNumber, customer.idType, customer.dv),
          customer.vatRegime,
          customer.taxLevelCode,
        ),
      ]),
      attachment(document.signedXml ?? ''),
      el('cac:ParentDocumentLineReference', {}, [
        el('cbc:LineID', {}, '1'),
        el('cac:DocumentReference', {}, [
          el('cbc:ID', {}, document.number),
          el('cbc:UUID', { schemeName: uniqueCodeScheme(document.type) }, document.uniqueCode ?? ''),
          el('cbc:IssueDate', {}, document.issueDate),
          el('cbc:IssueTime', {}, document.issueTime),
          el('cbc:DocumentType', {}, 'ApplicationResponse'),
          attachment(document.applicationResponse ?? ''),
          el('cac:ResultOfVerification', {}, [
            el('cbc:ValidatorID', {}, DIAN_VALIDATOR),
            el('cbc:ValidationResultCode', {}, '02'),
            el('cbc:ValidationDate', {}, validation.date),
            el('cbc:ValidationTime', {}, validation.time),
          ]),
        ]),
      ]),
    ]);
    return serializeDocument(root);
  }
}

function partyTaxScheme(name: string, id: XmlElement, vatRegime: string, taxLevelCode: string): XmlElement {
  return el('cac:PartyTaxScheme', {}, [
    el('cbc:RegistrationName', {}, name),
    id,
    el('cbc:TaxLevelCode', { listName: vatRegime }, taxLevelCode),
    vatScheme(),
  ]);
}

function attachment(xml: string): XmlElement {
  return el('cac:Attachment', {}, [
    el('cac:ExternalReference', {}, [
      el('cbc:MimeCode', {}, 'text/xml'),
      el('cbc:EncodingCode', {}, 'UTF-8'),
      el('cbc:Description', {}, [cdata(xml)]),
    ]),
  ]);
}

/** Issue date/time of the ApplicationResponse (validation moment); falls back to `fallback`. */
function validationTimestamp(applicationResponse: string, fallback: BogotaDateTime): BogotaDateTime {
  try {
    const root = parseXml(applicationResponse);
    const field = (name: string) => childElements(root).find((child) => localNameOf(child.name) === name);
    const date = field('IssueDate');
    const time = field('IssueTime');
    return { date: date ? textContent(date) : fallback.date, time: time ? textContent(time) : fallback.time };
  } catch {
    return fallback;
  }
}
