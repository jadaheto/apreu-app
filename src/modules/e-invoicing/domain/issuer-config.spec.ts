import { IssuerConfig, normalizeTaxResponsibilities } from './issuer-config.js';
import { issuerConfig, SINCELEJO } from '../testing/fixtures.js';

describe('normalizeTaxResponsibilities', () => {
  it.each([
    ['47-48', 'O-47;O-48'],
    ['O-13;O-15', 'O-13;O-15'],
    ['', 'R-99-PN'],
    ['r-99-pn', 'R-99-PN'],
    ['O-13, 15', 'O-13;O-15'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizeTaxResponsibilities(raw)).toBe(expected);
  });
});

describe('IssuerConfig', () => {
  const complete = {
    businessName: 'Colegio SAS',
    nit: '900.123.456-8',
    address: 'Calle 1',
    location: SINCELEJO,
    softwareId: '22d8dcee-1111-2222-3333-444444444444',
    softwarePin: '12345',
    email: 'FE@Colegio.co',
  };

  it('validates and normalizes an update', () => {
    const config = IssuerConfig.empty();
    config.update(complete);
    expect(config).toMatchObject({
      nit: '900123456',
      dv: '8',
      email: 'fe@colegio.co',
      environment: '2',
      usesTestSet: false,
    });
    expect(config.missingFields()).toEqual([]);
    expect(() => config.assertReadyToIssue()).not.toThrow();
  });

  it('keeps the software PIN when the update omits it (write-only secret)', () => {
    const config = issuerConfig();
    config.update({ softwarePin: '' });
    expect(config.softwarePin).toBe('12345');
    config.update({ softwarePin: '999' });
    expect(config.softwarePin).toBe('999');
  });

  it('reports missing data before issuing', () => {
    expect(() => IssuerConfig.empty().assertReadyToIssue()).toThrow(
      expect.objectContaining({ code: 'E_INVOICING_NOT_CONFIGURED' }),
    );
  });

  it.each([
    [{ personType: '2' as const }, 'PERSON_NAMES_REQUIRED'],
    [{ location: { ...SINCELEJO, departmentCode: '11' } }, 'INVALID_DANE_CODE'],
    [{ nit: '12' }, 'INVALID_NIT'],
    [{ providerCode: '1' }, 'INVALID_PROVIDER_CODE'],
    [{ softwareId: 'no válido!' }, 'INVALID_SOFTWARE_ID'],
  ])('rejects %o', (override, code) => {
    expect(() => IssuerConfig.empty().update({ ...complete, ...override })).toThrow(expect.objectContaining({ code }));
  });

  it('uses the test set only in habilitation with a TestSetId', () => {
    expect(issuerConfig({ testSetId: 'abc' }).usesTestSet).toBe(true);
    expect(issuerConfig({ testSetId: 'abc', environment: '1' }).usesTestSet).toBe(false);
  });
});
