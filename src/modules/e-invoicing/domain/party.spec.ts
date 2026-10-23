import { Party } from './party.js';
import { SINCELEJO } from '../testing/fixtures.js';

const base = {
  name: 'Ana María Ruiz Díaz',
  idType: '13',
  idNumber: '1.065.432',
  email: null,
  phone: null,
  address: null,
  location: SINCELEJO,
  taxLevelCode: '',
  vatRegime: '49' as const,
};

describe('Party', () => {
  it('normalizes the identification and derives a natural person', () => {
    const party = Party.create(base);
    expect(party).toMatchObject({
      idNumber: '1065432',
      personType: '2',
      dv: null,
      firstName: 'Ana',
      familyName: 'María Ruiz Díaz',
      taxLevelCode: 'R-99-PN',
    });
  });

  it('computes the DV for NIT holders (legal person)', () => {
    const party = Party.create({ ...base, idType: '31', idNumber: '900123456-1' });
    expect(party).toMatchObject({ idNumber: '900123456', dv: '8', personType: '1' });
  });

  it.each([
    [{ idType: '99' }, 'INVALID_ID_TYPE'],
    [{ idNumber: '@@' }, 'INVALID_ID_NUMBER'],
    [{ location: { ...SINCELEJO, cityCode: '11001' } }, 'INVALID_DANE_CODE'],
    [{ name: ' ' }, 'REQUIRED_FIELD'],
  ])('rejects %o', (override, code) => {
    expect(() => Party.create({ ...base, ...override })).toThrow(expect.objectContaining({ code }));
  });
});
