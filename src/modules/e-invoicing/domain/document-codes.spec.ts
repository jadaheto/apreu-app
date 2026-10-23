import {
  computeSoftwareSecurityCode,
  computeUniqueCode,
  qrUrl,
  uniqueCodeScheme,
  uniqueCodeSeed,
  type UniqueCodeInput,
} from './document-codes.js';
import { dianFileNames } from './file-naming.js';
import { computeDv } from './nit.js';

/** Vectors verified by running the legacy PHP (análisis 05 §3.4). */
const input: UniqueCodeInput = {
  type: 'fv',
  number: 'SETP990000001',
  issueDate: '2026-03-11',
  issueTime: '10:00:00-05:00',
  lineExtensionCents: 10_000_000,
  vatCents: 1_900_000,
  payableCents: 11_900_000,
  issuerNit: '900123456',
  customerIdNumber: '1065432198',
  key: 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
  environment: '2',
};

describe('CUFE / CUDE', () => {
  it('builds the exact concatenation of the annex', () => {
    expect(uniqueCodeSeed(input)).toBe(
      'SETP9900000012026-03-1110:00:00-05:00100000.000119000.00040.00030.00119000.009001234561065432198fc8eac422eba16e22ffd8c6f94b3f40a6e38162c2',
    );
  });

  it('matches the verified CUFE', () => {
    expect(computeUniqueCode(input)).toBe(
      'd5a1666721f234e3cdba1c591b9ca1db2c9adb841e12708f96a7e68d7e73db9ff48afa67d0836074b52a26ef88d22d28',
    );
  });

  it('CUDE uses the software PIN as key and its own scheme', () => {
    const cude = computeUniqueCode({ ...input, type: 'nc', key: '12345' });
    expect(cude).toMatch(/^[0-9a-f]{96}$/);
    expect(cude).not.toBe(computeUniqueCode(input));
    expect(uniqueCodeScheme('nc')).toBe('CUDE-SHA384');
    expect(uniqueCodeScheme('fv')).toBe('CUFE-SHA384');
  });

  it('matches the verified SoftwareSecurityCode', () => {
    expect(computeSoftwareSecurityCode('22d8dcee-1111-2222-3333-444444444444', '12345', 'SETP990000001')).toBe(
      '674ca1c3ff16fc0cffb0821ba284ee5dc4c9da9094149e8aeff49be89778ebe3ab9b6b71df1f4ef46409c0c12deff955',
    );
  });

  it('builds the QR URL per environment', () => {
    expect(qrUrl('1', 'abc')).toBe('https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=abc');
    expect(qrUrl('2', 'abc')).toBe('https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=abc');
  });
});

describe('file naming', () => {
  const base = {
    type: 'fv' as const,
    issuerNit: '900123456',
    consecutive: 990000001,
    year: 2026,
    providerCode: '000',
    softwareId: '22d8dcee-1111-2222-3333-444444444444',
  };

  it('reproduces the verified legacy name', () => {
    expect(dianFileNames({ ...base, mode: 'legacy' })).toEqual({
      xml: 'fv090012345622d8dcee20263b023381',
      zip: 'fv090012345622d8dcee20263b023381',
    });
  });

  it('follows the technical annex by default (ppp, 2-digit year, 8 hex, z prefix for the ZIP)', () => {
    expect(dianFileNames({ ...base, mode: 'annex' })).toEqual({
      xml: 'fv0900123456000263b023381',
      zip: 'z0900123456000263b023381',
    });
    expect(dianFileNames({ ...base, mode: 'annex', type: 'nc', consecutive: 26 }).xml).toBe(
      'nc0900123456000260000001a',
    );
  });
});

describe('computeDv', () => {
  it.each([
    ['800197268', '4'],
    ['7368773', '0'],
    ['900123456', '8'],
    ['800987654', '4'],
    ['900555111', '6'],
  ])('DV of %s is %s', (nit, dv) => {
    expect(computeDv(nit)).toBe(dv);
  });
});
