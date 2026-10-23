import { resolution } from '../testing/fixtures.js';

describe('NumberingResolution', () => {
  it('reserves consecutive numbers without zero padding', () => {
    const fv = resolution();
    expect(fv.reserveNext('2026-03-15', '2')).toEqual({
      prefix: 'SETP',
      consecutive: 990000001,
      cycle: 0,
      number: 'SETP990000001',
    });
    expect(fv.reserveNext('2026-03-15', '2').consecutive).toBe(990000002);
    expect(fv.remaining).toBe(995000000 - 990000002);
  });

  it('fails when the range is exhausted', () => {
    const fv = resolution({ rangeFrom: 1, rangeTo: 1 });
    fv.reserveNext('2026-03-15', '2');
    expect(() => fv.reserveNext('2026-03-15', '2')).toThrow(
      expect.objectContaining({ code: 'NUMBERING_RANGE_EXHAUSTED' }),
    );
  });

  it.each([
    ['2031-01-01', '2', 'RESOLUTION_EXPIRED'],
    ['2018-01-01', '2', 'RESOLUTION_EXPIRED'],
    ['2026-03-15', '1', 'RESOLUTION_ENVIRONMENT_MISMATCH'],
  ])('rejects issuing on %s in environment %s', (date, environment, code) => {
    expect(() => resolution().reserveNext(date, environment as '1' | '2')).toThrow(expect.objectContaining({ code }));
  });

  it('rejects inactive ranges', () => {
    const fv = resolution();
    fv.deactivate();
    expect(() => fv.reserveNext('2026-03-15', '2')).toThrow(expect.objectContaining({ code: 'RESOLUTION_INACTIVE' }));
  });

  it('requires resolution data and technical key only for invoices', () => {
    expect(() => resolution({ technicalKey: null })).toThrow(
      expect.objectContaining({ code: 'INCOMPLETE_RESOLUTION' }),
    );
    expect(resolution({ docType: 'nc' }).technicalKey).toBeNull();
  });

  it.each([
    [{ prefix: 'SETPX' }, 'INVALID_PREFIX'],
    [{ rangeFrom: 10, rangeTo: 5 }, 'INVALID_RANGE'],
    [{ validFrom: '2026-02-01', validTo: '2026-01-01' }, 'INVERTED_DATES'],
    [{ validTo: '31/12/2026' }, 'INVALID_DATE'],
  ])('rejects %o', (override, code) => {
    expect(() => resolution(override)).toThrow(expect.objectContaining({ code }));
  });

  it('changes range, dates and key keeping invariants', () => {
    const fv = resolution({ rangeFrom: 1, rangeTo: 10 });
    fv.reserveNext('2026-03-15', '2');
    fv.change({ rangeTo: 20, technicalKey: 'nueva', validTo: '2031-01-01' });
    expect(fv).toMatchObject({ rangeTo: 20, technicalKey: 'nueva', validTo: '2031-01-01' });
    expect(() => fv.change({ rangeTo: 0 })).toThrow(expect.objectContaining({ code: 'INVALID_RANGE' }));
  });

  it('resets habilitation numbering into a new cycle', () => {
    const fv = resolution();
    fv.reserveNext('2026-03-15', '2');
    fv.resetForHabilitation();
    expect(fv.reserveNext('2026-03-15', '2')).toMatchObject({ consecutive: 990000001, cycle: 1 });
    const production = resolution({ environment: '1' });
    expect(() => production.resetForHabilitation()).toThrow(expect.objectContaining({ code: 'RESET_NOT_ALLOWED' }));
  });
});
