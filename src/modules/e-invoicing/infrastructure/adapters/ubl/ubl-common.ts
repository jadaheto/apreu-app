import { Amounts } from '../../../domain/amounts.js';
import type { DaneLocation } from '../../../domain/party.js';
import { el, type XmlElement } from '../../xml/xml-writer.js';

/** UBL 2.1 / DIAN namespaces (declared on the root, in this order). */
export const NS = {
  cac: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
  cbc: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
  ext: 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  sts: 'dian:gov:co:facturaelectronica:Structures-2-1',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  xades: 'http://uri.etsi.org/01903/v1.3.2#',
  xades141: 'http://uri.etsi.org/01903/v1.4.1#',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/** `xmlns:*` attributes for a root element whose default namespace is `defaultNs`. */
export const rootNamespaces = (defaultNs: string): Record<string, string> => ({
  xmlns: defaultNs,
  'xmlns:cac': NS.cac,
  'xmlns:cbc': NS.cbc,
  'xmlns:ext': NS.ext,
  'xmlns:sts': NS.sts,
  'xmlns:ds': NS.ds,
  'xmlns:xades': NS.xades,
  'xmlns:xades141': NS.xades141,
  'xmlns:xsi': NS.xsi,
});

export const DIAN_AGENCY = {
  schemeAgencyID: '195',
  schemeAgencyName: 'CO, DIAN (Dirección de Impuestos y Aduanas Nacionales)',
} as const;

/** NIT of the DIAN as authorization provider. */
export const DIAN_NIT = '800197268';

export const amount = (name: string, cents: number): XmlElement =>
  el(name, { currencyID: 'COP' }, Amounts.format(cents));

/** `cac:Address` / `cac:RegistrationAddress` with DANE codes. */
export const address = (
  name: string,
  location: DaneLocation,
  line: string | null,
  postalCode: string | null,
): XmlElement =>
  el(name, {}, [
    el('cbc:ID', {}, location.cityCode),
    el('cbc:CityName', {}, location.cityName),
    postalCode && el('cbc:PostalZone', {}, postalCode),
    el('cbc:CountrySubentity', {}, location.departmentName),
    el('cbc:CountrySubentityCode', {}, location.departmentCode),
    el('cac:AddressLine', {}, [el('cbc:Line', {}, line ?? '')]),
    el('cac:Country', {}, [el('cbc:IdentificationCode', {}, 'CO'), el('cbc:Name', { languageID: 'es' }, 'Colombia')]),
  ]);

export const vatScheme = (): XmlElement => el('cac:TaxScheme', {}, [el('cbc:ID', {}, '01'), el('cbc:Name', {}, 'IVA')]);

/** `cbc:CompanyID` with the DIAN agency attributes. */
export const companyId = (idNumber: string, idType: string, dv: string | null): XmlElement =>
  el('cbc:CompanyID', { ...DIAN_AGENCY, schemeID: dv ?? undefined, schemeName: idType }, idNumber);
