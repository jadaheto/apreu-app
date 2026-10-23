import { calculateNitDv, Nit } from './nit.js';

describe('calculateNitDv', () => {
  it.each([
    ['800197268', 4],
    ['900123456', 8],
    ['860002464', 3],
  ])('NIT %s → DV %i', (nit, dv) => {
    expect(calculateNitDv(nit)).toBe(dv);
  });

  it('rejects non numeric input', () => {
    expect(() => calculateNitDv('80A')).toThrow(expect.objectContaining({ code: 'INVALID_NIT' }));
  });
});

describe('Nit', () => {
  it('normalizes dots and calculates the check digit', () => {
    const nit = Nit.create('900.123.456');
    expect(nit).toMatchObject({ number: '900123456', dv: 8 });
    expect(nit.format()).toBe('900123456-8');
  });

  it('accepts a matching typed DV and rejects a wrong one', () => {
    expect(Nit.create('800197268-4').dv).toBe(4);
    expect(() => Nit.create('800197268-5')).toThrow(expect.objectContaining({ code: 'INVALID_NIT_DV' }));
  });

  it.each(['', '123', 'abc123456', '1-2-3'])('rejects "%s"', (raw) => {
    expect(() => Nit.create(raw)).toThrow(expect.objectContaining({ code: 'INVALID_NIT' }));
  });

  it('has no check digit for a cédula', () => {
    expect(Nit.create('1020304050', 'CC')).toMatchObject({ number: '1020304050', dv: null });
    expect(Nit.create('1020304050', 'CC').format()).toBe('1020304050');
    expect(() => Nit.create('1020304050-1', 'CC')).toThrow(expect.objectContaining({ code: 'INVALID_NIT' }));
  });
});
