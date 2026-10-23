import { DocumentLine } from '../domain/document-line.js';
import { ElectronicDocument, type IssueDocumentInput } from '../domain/electronic-document.js';
import { IssuerConfig, type IssuerConfigProps } from '../domain/issuer-config.js';
import { NumberingResolution, type RegisterResolutionInput } from '../domain/numbering-resolution.js';
import { Party, type PartyProps } from '../domain/party.js';
import type { DianResponse } from '../domain/dian-response.js';

/** Data of the verified vectors of the functional analysis (§3.4). */
export const VECTOR = {
  nit: '900123456',
  softwareId: '22d8dcee-1111-2222-3333-444444444444',
  softwarePin: '12345',
  technicalKey: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
  customerId: '1065432198',
};

export const SINCELEJO = { cityCode: '70001', cityName: 'SINCELEJO', departmentCode: '70', departmentName: 'SUCRE' };

export function issuerConfig(overrides: Partial<IssuerConfigProps> = {}): IssuerConfig {
  return IssuerConfig.restore({
    ...IssuerConfig.empty().toProps(),
    businessName: 'Colegio de Pruebas SAS',
    nit: VECTOR.nit,
    address: 'Calle 1 # 2-3',
    location: SINCELEJO,
    email: 'facturacion@colegio.test',
    phone: '3000000000',
    softwareId: VECTOR.softwareId,
    softwarePin: VECTOR.softwarePin,
    environment: '2',
    testSetId: null,
    ...overrides,
  });
}

export function resolution(overrides: Partial<RegisterResolutionInput> = {}): NumberingResolution {
  const docType = overrides.docType ?? 'fv';
  return NumberingResolution.register({
    docType,
    prefix: docType === 'fv' ? 'SETP' : docType.toUpperCase(),
    rangeFrom: 990000001,
    rangeTo: 995000000,
    resolutionNumber: docType === 'fv' ? '18760000001' : null,
    validFrom: docType === 'fv' ? '2019-01-19' : null,
    validTo: docType === 'fv' ? '2030-01-19' : null,
    technicalKey: docType === 'fv' ? VECTOR.technicalKey : null,
    environment: '2',
    ...overrides,
  });
}

export function customer(overrides: Partial<PartyProps> = {}): Party {
  return Party.create({
    name: 'María Fernanda Gómez',
    idType: '13',
    idNumber: VECTOR.customerId,
    email: 'maria@example.com',
    phone: null,
    address: 'Carrera 5 # 10-20',
    location: SINCELEJO,
    taxLevelCode: 'R-99-PN',
    vatRegime: '49',
    ...overrides,
  });
}

export const excludedLine = (unitPrice = 350000) =>
  DocumentLine.create({ description: 'Pensión marzo', code: 'PEN', quantity: 1, unitPrice });

export const taxedLine = (unitPrice = 100000) =>
  DocumentLine.create({
    description: 'Uniforme',
    code: 'UNI',
    quantity: 1,
    unitPrice,
    taxTreatment: 'taxed',
    taxRate: 19,
  });

/** A signed invoice ready to be submitted. */
export function signedInvoice(overrides: Partial<IssueDocumentInput> = {}): ElectronicDocument {
  const document = ElectronicDocument.issue({
    type: 'fv',
    reserved: { prefix: 'SETP', consecutive: 990000001, cycle: 0, number: 'SETP990000001' },
    environment: '2',
    issuedAt: { date: '2026-03-15', time: '10:00:00-05:00' },
    customer: customer(),
    lines: [excludedLine()],
    paymentMeans: { form: '1', code: '10', dueDate: null },
    ...overrides,
  });
  document.sign({
    uniqueCode: 'cufe-1',
    securityCode: 'ssc',
    qrUrl: 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=cufe-1',
    fileNames: { xml: 'fv0900123456000260003b023381', zip: 'z0900123456000260003b023381' },
    signedXml: '<Invoice/>',
  });
  return document;
}

export const dianResponse = (overrides: Partial<DianResponse> = {}): DianResponse => ({
  statusCode: '00',
  statusDescription: 'Procesado Correctamente.',
  isValid: true,
  messages: [],
  trackId: 'cufe-1',
  applicationResponse:
    '<ApplicationResponse><cbc:IssueDate xmlns:cbc="urn:cbc">2026-03-15</cbc:IssueDate></ApplicationResponse>',
  applicationResponseCode: '02',
  ...overrides,
});
