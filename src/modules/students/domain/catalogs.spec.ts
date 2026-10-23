import { assertCalendarDate, initialsOf, optionalEmail, optionalText, requiredText } from './catalogs.js';
import { isCertificateConceptName } from './certificate-concept-catalog.port.js';

describe('catalog helpers', () => {
  it('validates calendar days', () => {
    expect(() => assertCalendarDate('2024-02-29', 'f')).not.toThrow();
    expect(() => assertCalendarDate('2025-02-29', 'f')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
    expect(() => assertCalendarDate('2025-1-01', 'f')).toThrow(expect.objectContaining({ code: 'INVALID_DATE' }));
  });

  it('normalizes texts and e-mails', () => {
    expect(optionalText('  ', 10, 'x')).toBeNull();
    expect(optionalText(' a ', 10, 'x')).toBe('a');
    expect(requiredText(' b ', 10, 'x')).toBe('b');
    expect(optionalEmail(' A@B.CO ')).toBe('a@b.co');
    expect(optionalEmail(undefined)).toBeNull();
    expect(initialsOf('sofía', 'gómez')).toBe('SG');
  });

  it.each([
    ['Certificado de estudio', true],
    ['CERTIFICADO', true],
    ['Pensión marzo', false],
  ])('detects certificate concepts by name: %s', (name, expected) => {
    expect(isCertificateConceptName(name)).toBe(expected);
  });
});
